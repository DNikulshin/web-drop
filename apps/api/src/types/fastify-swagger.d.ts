import type { FastifyDynamicSwaggerOptions } from "@fastify/swagger";

declare module "@fastify/swagger" {
  interface FastifyDynamicSwaggerOptions {
    routePrefix?: string;
    exposeRoute?: boolean;
  }
}
