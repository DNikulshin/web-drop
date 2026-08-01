import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { sessionRoutes } from "./session.routes.js";

const buildServer = async () => {
  const server = Fastify();
  await server.register(sessionRoutes, { prefix: "" });
  return server;
};

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
});
