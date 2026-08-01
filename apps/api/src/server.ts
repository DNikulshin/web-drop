import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { sessionRoutes } from "./modules/session/session.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { redis, redisSubscriber } from "./shared/lib/redis.js";

const server = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
  ajv: {
    customOptions: {
      strict: false,
    },
  },
});

await redis.connect();
await redisSubscriber.connect();

await server.register(fastifyCors, {
  origin: process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL || "http://localhost:3000" : true,
  credentials: true,
});

await server.register(fastifySwagger as any, {
  routePrefix: "/documentation",
  openapi: {
    info: {
      title: "Web Drop API",
      description: "API documentation for the Web Drop backend",
      version: "1.0.0",
    },
    servers: [{ url: "/", description: "Relative server path" }],
  },
  exposeRoute: true,
});

await server.register(fastifySwaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: true,
  },
  staticCSP: true,
  validatorUrl: false,
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
