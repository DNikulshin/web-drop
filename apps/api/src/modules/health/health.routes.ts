import { FastifyInstance } from "fastify";
import { redisIsConnected, getRedisStatus } from "../../shared/lib/redis.js";

const healthSchema = {
  summary: "Health check",
  description: "Returns the application status.",
  response: {
    200: {
      type: "object",
      properties: {
        status: { type: "string" },
      },
      required: ["status"],
    },
  },
};

const readySchema = {
  summary: "Readiness check",
  description: "Returns whether the application is ready to handle requests.",
  response: {
    200: {
      type: "object",
      properties: {
        status: { type: "string" },
        redis: { type: "boolean" },
        details: {
          type: "object",
          properties: {
            redis: { type: "string" },
            subscriber: { type: "string" },
            circuitOpen: { type: "boolean" },
          },
          required: ["redis", "subscriber", "circuitOpen"],
        },
      },
      required: ["status", "redis", "details"],
    },
    503: {
      type: "object",
      properties: {
        status: { type: "string" },
        redis: { type: "boolean" },
        details: {
          type: "object",
          properties: {
            redis: { type: "string" },
            subscriber: { type: "string" },
            circuitOpen: { type: "boolean" },
          },
          required: ["redis", "subscriber", "circuitOpen"],
        },
      },
      required: ["status", "redis", "details"],
    },
  },
};

export async function healthRoutes(server: FastifyInstance) {
  server.get("/health/live", { schema: healthSchema }, async () => ({ status: "ok" }));

  server.get("/health/ready", { schema: readySchema }, async (request, reply) => {
    const redisConnected = redisIsConnected();
    const details = getRedisStatus();

    if (!redisConnected) {
      return reply.code(503).send({
        status: "unavailable",
        redis: false,
        details,
      });
    }

    return { status: "ok", redis: true, details };
  });
}
