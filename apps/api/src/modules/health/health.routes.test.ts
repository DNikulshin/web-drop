import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { healthRoutes } from "./health.routes.js";

const buildServer = async () => {
  const server = Fastify();
  await server.register(healthRoutes, { prefix: "" });
  return server;
};

describe("Health routes", () => {
  it("should return live status", async () => {
    const server = await buildServer();
    const response = await server.inject({ method: "GET", url: "/health/live" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await server.close();
  });

  it("should return readiness status", async () => {
    const server = await buildServer();
    const response = await server.inject({ method: "GET", url: "/health/ready" });
    const payload = response.json();

    expect(response.statusCode === 200 || response.statusCode === 503).toBe(true);
    expect(payload).toHaveProperty("status");
    expect(payload).toHaveProperty("redis");
    expect(payload).toHaveProperty("details");

    if (response.statusCode === 200) {
      expect(payload.status).toBe("ok");
      expect(payload.redis).toBe(true);
    } else {
      expect(payload.status).toBe("unavailable");
      expect(payload.redis).toBe(false);
    }

    await server.close();
  });
});
