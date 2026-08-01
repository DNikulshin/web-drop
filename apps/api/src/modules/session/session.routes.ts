import { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import {
  createSessionBodySchema,
  sessionCreatedResponseSchema,
  textUpdatePayloadSchema,
} from "@web-drop/contracts";
import {
  addSessionStreamEvent,
  ensureConsumerGroup,
  getSessionChannel,
  getSessionGroupName,
  publishSessionEvent,
  redisIsConnected,
  subscribeSessionChannel,
  getSessionStreamKey,
} from "../../shared/lib/redis.js";

export async function sessionRoutes(server: FastifyInstance) {
  server.post("/api/sessions", async (request, reply) => {
    const body = createSessionBodySchema.parse(request.body ?? {});
    const code = nanoid(10);
    const expiresAt = new Date(Date.now() + (body.ttlSeconds ?? 86400) * 1000).toISOString();

    await addSessionStreamEvent(code, {
      type: "session.created",
      code,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    return reply.status(201).send(sessionCreatedResponseSchema.parse({ code, expiresAt }));
  });

  server.get("/api/sessions/:code", async (request, reply) => {
    const { code } = request.params as { code: string };
    const group = getSessionGroupName(code);
    const streamKey = getSessionStreamKey(code);

    await ensureConsumerGroup(streamKey, group);

    return reply.send({ code, ready: true, redis: redisIsConnected() });
  });

  server.register(async (instance) => {
    instance.get("/ws/session/:code", { websocket: true }, (connection, request) => {
      const { code } = request.params as { code: string };
      const channel = getSessionChannel(code);
      const group = getSessionGroupName(code);
      const streamKey = getSessionStreamKey(code);

      let unsubscribe: (() => Promise<void>) | undefined;

      const sendJson = (payload: unknown) => {
        if (connection.readyState === 1) {
          connection.send(JSON.stringify(payload));
        }
      };

      const cleanup = async () => {
        if (unsubscribe) {
          await unsubscribe();
          unsubscribe = undefined;
        }
      };

      subscribeSessionChannel(code, (event: Record<string, unknown>) => {
        sendJson({ type: "session.event", event });
      }).then((unsub: () => Promise<void>) => {
        unsubscribe = unsub;
      });

      connection.on("message", async (message: unknown) => {
        try {
          const payload = JSON.parse((message as any).toString());
          const parsed = textUpdatePayloadSchema.safeParse(payload);

          if (parsed.success) {
            const event = {
              type: "text.update",
              code,
              data: parsed.data.data,
              sender: request.headers["x-forwarded-for"] || request.ip,
              createdAt: new Date().toISOString(),
            };

            await addSessionStreamEvent(code, event);
            await publishSessionEvent(code, event);
          }
        } catch {
          // ignore invalid JSON
        }
      });

      connection.on("close", cleanup);
      connection.on("error", cleanup);
    });
  });
}
