import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_CIRCUIT_BREAKER_FAIL_THRESHOLD = Number(
  process.env.REDIS_CIRCUIT_BREAKER_FAIL_THRESHOLD ?? 3,
);
const REDIS_CIRCUIT_BREAKER_OPEN_MS = Number(
  process.env.REDIS_CIRCUIT_BREAKER_OPEN_MS ?? 10000,
);

const globalForRedis = globalThis as unknown as {
  redis: Redis;
  redisSubscriber: Redis;
};

export let redis: Redis =
  globalForRedis.redis ||
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

export let redisSubscriber: Redis =
  globalForRedis.redisSubscriber ||
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

export const INSTANCE_ID =
  process.env.INSTANCE_ID ||
  `instance-${Date.now()}-${Math.random().toString(36).slice(2)}`;

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
  globalForRedis.redisSubscriber = redisSubscriber;
}

export async function recreateRedisClients() {
  try {
    await redis.disconnect();
  } catch (_) {
    // ignore
  }

  try {
    await redisSubscriber.disconnect();
  } catch (_) {
    // ignore
  }

  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

  redisSubscriber = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.redis = redis;
    globalForRedis.redisSubscriber = redisSubscriber;
  }
}

export async function ensureRedisClientsReady(): Promise<boolean> {
  if (redis.status === "ready" && redisSubscriber.status === "ready") return true;

  try {
    if (redis.status !== "ready") await redis.connect();
    if (redisSubscriber.status !== "ready") await redisSubscriber.connect();
    return true;
  } catch (err) {
    return false;
  }
}

let consecutiveRedisFailures = 0;
let circuitOpenUntil = 0;

function isCircuitOpen() {
  return circuitOpenUntil > Date.now();
}

function recordRedisSuccess() {
  consecutiveRedisFailures = 0;
  circuitOpenUntil = 0;
}

function recordRedisFailure() {
  consecutiveRedisFailures += 1;
  if (consecutiveRedisFailures >= REDIS_CIRCUIT_BREAKER_FAIL_THRESHOLD) {
    circuitOpenUntil = Date.now() + REDIS_CIRCUIT_BREAKER_OPEN_MS;
  }
}

async function withRedisOperation<T>(operation: () => Promise<T>) {
  if (isCircuitOpen()) {
    throw new Error("Redis circuit breaker is open");
  }

  if (redis.status !== "ready" && redis.status !== "connecting") {
    await redis.connect();
  }

  try {
    const result = await operation();
    recordRedisSuccess();
    return result;
  } catch (err) {
    recordRedisFailure();
    throw err;
  }
}

export function getSessionStreamKey(code: string) {
  return `session:${code}:stream`;
}

export function getSessionChannel(code: string) {
  return `session:${code}:channel`;
}

export function getSessionGroupName(code: string) {
  return `session:${code}:group`;
}

export function getSessionMetaKey(code: string) {
  return `session:${code}:meta`;
}

export async function ensureConsumerGroup(
  streamKey: string,
  groupName: string,
) {
  return withRedisOperation(async () => {
    try {
      await redis.xgroup("CREATE", streamKey, groupName, "$", "MKSTREAM");
    } catch (err: any) {
      if (!err.message.includes("BUSYGROUP")) {
        throw err;
      }
    }
  });
}

export async function setSessionMetadata(
  code: string,
  metadata: { createdAt: string; ttlSeconds: number; expiresAt: string },
) {
  const metaKey = getSessionMetaKey(code);
  const streamKey = getSessionStreamKey(code);
  const ttlSeconds = metadata.ttlSeconds;

  return withRedisOperation(async () => {
    await redis.set(metaKey, JSON.stringify(metadata), "EX", ttlSeconds);
    await redis.expire(streamKey, ttlSeconds);
  });
}

export async function getSessionMetadata(code: string) {
  const metaKey = getSessionMetaKey(code);
  const raw = await withRedisOperation(async () => redis.get(metaKey));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as { createdAt: string; ttlSeconds: number; expiresAt: string };
  } catch {
    return null;
  }
}

export async function refreshSessionTTL(code: string) {
  const metadata = await getSessionMetadata(code);
  if (!metadata) return;

  const metaKey = getSessionMetaKey(code);
  const streamKey = getSessionStreamKey(code);
  const ttlSeconds = metadata.ttlSeconds;

  return withRedisOperation(async () => {
    await redis.expire(streamKey, ttlSeconds);
    await redis.expire(metaKey, ttlSeconds);
  });
}

export async function sessionExists(code: string) {
  const metaKey = getSessionMetaKey(code);
  return withRedisOperation(async () => (await redis.exists(metaKey)) > 0);
}

export async function deleteSession(code: string) {
  const metaKey = getSessionMetaKey(code);
  const streamKey = getSessionStreamKey(code);
  return withRedisOperation(async () => {
    await redis.del(streamKey, metaKey);
  });
}

export async function addSessionStreamEvent(
  code: string,
  event: Record<string, unknown>,
) {
  const streamKey = getSessionStreamKey(code);
  return withRedisOperation(async () => {
    await redis.xadd(streamKey, "*", "event", JSON.stringify(event));
  });
}

export async function publishSessionEvent(
  code: string,
  event: Record<string, unknown>,
) {
  const channel = getSessionChannel(code);
  return withRedisOperation(async () => {
    await redis.publish(channel, JSON.stringify(event));
  });
}

export async function getSessionStreamEvents(
  code: string,
  options?: { count?: number; reverse?: boolean },
) {
  const streamKey = getSessionStreamKey(code);
  const count = options?.count ?? 100;

  return withRedisOperation(async () => {
    const rawEvents = options?.reverse
      ? await redis.xrevrange(streamKey, "+", "-", "COUNT", count)
      : await redis.xrange(streamKey, "-", "+", "COUNT", count);

    return rawEvents.map(([id, fields]) => {
      const eventIndex = fields.findIndex((field) => field === "event");
      const rawPayload = eventIndex >= 0 ? fields[eventIndex + 1] : null;
      let event: Record<string, unknown> = {};

      if (rawPayload) {
        try {
          event = JSON.parse(rawPayload as string) as Record<string, unknown>;
        } catch {
          event = { raw: rawPayload };
        }
      }

      return { id, event };
    });
  });
}

export async function subscribeSessionChannel(
  code: string,
  onMessage: (event: Record<string, unknown>) => void,
) {
  const channel = getSessionChannel(code);
  const subscriber = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  await withRedisOperation(async () => {
    await subscriber.connect();
    await subscriber.subscribe(channel);
  });

  const listener = (channelName: string, message: string) => {
    if (channelName !== channel) return;
    try {
      const event = JSON.parse(message) as Record<string, unknown>;
      onMessage(event);
    } catch {
      // ignore malformed messages
    }
  };

  subscriber.on("message", listener);

  return async () => {
    subscriber.off("message", listener);
    await subscriber.unsubscribe(channel);
    await subscriber.disconnect();
  };
}

export function redisIsConnected() {
  return (
    !isCircuitOpen() &&
    redis.status === "ready" &&
    redisSubscriber.status === "ready"
  );
}

export function getRedisStatus() {
  return {
    redis: redis.status,
    subscriber: redisSubscriber.status,
    circuitOpen: isCircuitOpen(),
    openUntil: circuitOpenUntil,
  };
}
