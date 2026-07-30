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
