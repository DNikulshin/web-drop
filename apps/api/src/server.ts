import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import fastifyCors from "@fastify/cors";
import { sessionRoutes } from "./modules/session/session.routes";
import { healthRoutes } from "./modules/health/health.routes";
import { redis, redisSubscriber } from "./shared/lib/redis";

const server = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

await redis.connect();
await redisSubscriber.connect();

await server.register(fastifyCors, {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
});

await server.register(fastifyWebsocket);
await server.register(healthRoutes, { prefix: "" });
await server.register(sessionRoutes, { prefix: "" });

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    await server.listen({ port, host: "0.0.0.0" });
    server.log.info(`Server listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
