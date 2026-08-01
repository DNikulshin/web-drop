import { FastifyInstance } from "fastify";

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

export async function healthRoutes(server: FastifyInstance) {
  server.get("/health", { schema: healthSchema }, async () => ({ status: "ok" }));
}
