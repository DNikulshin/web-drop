import { afterEach, describe, expect, it } from "vitest";
import { AddressInfo } from "net";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import WebSocket from "ws";
import { sessionRoutes } from "./session.routes.js";
import { redis, redisSubscriber, recreateRedisClients } from "../../shared/lib/redis.js";

const buildServer = async () => {
  if (redis.status !== "ready") {
    await redis.connect();
  }
  if (redisSubscriber.status !== "ready") {
    await redisSubscriber.connect();
  }

  const server = Fastify();
  await server.register(fastifyWebsocket);
  await server.register(sessionRoutes, { prefix: "" });
  return server;
};

afterEach(async () => {
  // Recreate Redis clients to ensure a fresh state between tests.
  try {
    await recreateRedisClients();
  } catch (err) {
    console.log(err)
  }
});

describe("Session routes", () => {
  it("should create a session and return a code", async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { ttlSeconds: 60 },
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json();
    expect(payload).toHaveProperty("code");
    expect(payload).toHaveProperty("expiresAt");
    await server.close();
  });

  it("should return session history and status", async () => {
    const server = await buildServer();
    const createResponse = await server.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {},
    });
    const { code } = createResponse.json();

    const statusResponse = await server.inject({ method: "GET", url: `/api/sessions/${code}` });
    expect([200, 503]).toContain(statusResponse.statusCode);
    expect(statusResponse.json()).toHaveProperty("code");

    const historyResponse = await server.inject({ method: "GET", url: `/api/sessions/${code}/history` });
    expect([200, 503]).toContain(historyResponse.statusCode);
    expect(historyResponse.json()).toHaveProperty("events");

    await server.close();
  });

  it("should accept text updates over HTTP and return ok", async () => {
    const server = await buildServer();
    const createResponse = await server.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {},
    });
    const { code } = createResponse.json();

    const textResponse = await server.inject({
      method: "POST",
      url: `/api/sessions/${code}/text`,
      payload: { type: "session.text.update", data: "hello" },
    });

    expect([200, 503]).toContain(textResponse.statusCode);
    const payload = textResponse.json();
    expect(payload).toHaveProperty("status");
    await server.close();
  });

  it("should open a WebSocket session and receive text updates", async () => {
    const server = await buildServer();
    await server.listen({ host: "127.0.0.1", port: 0 });
    const address = server.server.address() as AddressInfo;
    const createResponse = await server.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {},
    });
    console.log('create response', createResponse.statusCode, createResponse.json());
    const { code } = createResponse.json();
    if (!code) {
      throw new Error(`Session code missing: ${JSON.stringify(createResponse.json())}`);
    }
    const wsUrl = `ws://127.0.0.1:${address.port}/ws/session/${code}`;

    const message = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => reject(new Error("WebSocket timeout")), 2000);

      ws.on("open", () => {
        console.log('WS open');
        setTimeout(() => {
          console.log('WS send message');
          ws.send(JSON.stringify({ type: "session.text.update", data: "hello websocket" }));
        }, 200);
      });

      ws.on("message", (data) => {
        clearTimeout(timeout);
        try {
          const parsed = JSON.parse(data.toString()) as Record<string, unknown>;
          console.log('WS received', parsed);
          resolve(parsed);
        } catch (error) {
          reject(error);
        } finally {
          ws.close();
        }
      });

      ws.on("close", (code, reason) => {
        console.log('WS close', code, reason.toString());
      });

      ws.on("error", (error) => {
        console.log('WS error', error);
        reject(error);
      });
    });

    expect(message).toHaveProperty("type");
    expect(message.type).toBe("session.event");

    await server.close();
  });
});
