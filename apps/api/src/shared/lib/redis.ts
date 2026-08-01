import { Redis } from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis;
  redisSubscriber: Redis;
};

export const redis =
  globalForRedis.redis ||
  new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

export const redisSubscriber =
  globalForRedis.redisSubscriber ||
  new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
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

export function getSessionStreamKey(code: string) {
  return `session:${code}:stream`;
}

export function getSessionChannel(code: string) {
  return `session:${code}:channel`;
}

export function getSessionGroupName(code: string) {
  return `session:${code}:group`;
}

export async function ensureConsumerGroup(
  streamKey: string,
  groupName: string,
) {
  try {
    await redis.xgroup("CREATE", streamKey, groupName, "$", "MKSTREAM");
  } catch (err: any) {
    if (!err.message.includes("BUSYGROUP")) {
      throw err;
    }
  }
}

export async function addSessionStreamEvent(
  code: string,
  event: Record<string, unknown>,
) {
  const streamKey = getSessionStreamKey(code);
  await redis.xadd(streamKey, "*", "event", JSON.stringify(event));
}

export async function publishSessionEvent(
  code: string,
  event: Record<string, unknown>,
) {
  const channel = getSessionChannel(code);
  await redis.publish(channel, JSON.stringify(event));
}

export async function subscribeSessionChannel(
  code: string,
  onMessage: (event: Record<string, unknown>) => void,
) {
  const channel = getSessionChannel(code);
  await redisSubscriber.subscribe(channel);

  const listener = (channelName: string, message: string) => {
    if (channelName !== channel) return;
    try {
      const event = JSON.parse(message) as Record<string, unknown>;
      onMessage(event);
    } catch {
      // ignore malformed messages
    }
  };

  redisSubscriber.on("message", listener);

  return async () => {
    redisSubscriber.off("message", listener);
    await redisSubscriber.unsubscribe(channel);
  };
}

export function redisIsConnected() {
  return redis.status === "ready" && redisSubscriber.status === "ready";
}
