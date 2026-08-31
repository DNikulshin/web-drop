import { describe, expect, it, beforeAll, afterAll } from "vitest";

import {
  redis,
  redisSubscriber,
  getSessionChannel,
  getSessionGroupName,
  getSessionStreamKey,
  addSessionStreamEvent,
  publishSessionEvent,
  subscribeSessionChannel,
  ensureConsumerGroup,
  redisIsConnected,
} from "./redis.js";

describe("Redis utilities", () => {
  beforeAll(async () => {
    await redis.connect();
    await redisSubscriber.connect();
  });

  afterAll(async () => {
    await redis.disconnect();
    await redisSubscriber.disconnect();
  });

  it("should compute stable session keys", () => {
    expect(getSessionStreamKey("abc123")).toBe("session:abc123:stream");
    expect(getSessionChannel("abc123")).toBe("session:abc123:channel");
    expect(getSessionGroupName("abc123")).toBe("session:abc123:group");
  });

  it("should report connection status when Redis is ready", () => {
    expect(typeof redisIsConnected()).toBe("boolean");
  });

  it("should create consumer group and add stream events", async () => {
    const code = `test-${Date.now()}`;
    const streamKey = getSessionStreamKey(code);
    const groupName = getSessionGroupName(code);

    await ensureConsumerGroup(streamKey, groupName);
    await addSessionStreamEvent(code, { type: "test.event", code });
  });

  it("should publish and subscribe to a session channel", async () => {
    const code = `test-${Date.now()}-pubsub`;

    const expectedMessage = { type: "session.test", code, payload: "data" };

    const unsubscribe = await subscribeSessionChannel(code, (event) => {
      expect(event).toEqual(expectedMessage);
    });

    await publishSessionEvent(code, expectedMessage);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await unsubscribe();
  });
});
