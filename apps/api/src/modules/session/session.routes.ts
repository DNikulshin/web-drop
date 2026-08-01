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
  getRedisStatus,
} from "../../shared/lib/redis.js";

const createSessionBodyJsonSchema = {
  type: "object",
  properties: {
    ttlSeconds: {
      type: "integer",
      minimum: 1,
      example: 60,
      description: "Time-to-live for the session in seconds.",
    },
  },
  additionalProperties: false,
};

const sessionCreatedResponseJsonSchema = {
  type: "object",
  properties: {
    code: { type: "string", example: "IiCA_hJePx" },
    expiresAt: { type: "string", format: "date-time", example: new Date(Date.now() + 60000).toISOString() },
  },
  required: ["code", "expiresAt"],
};

const sessionStatusResponseJsonSchema = {
  type: "object",
  properties: {
    code: { type: "string", example: "IiCA_hJePx" },
    ready: { type: "boolean", example: true },
    redis: { type: "boolean", example: true },
    redisStatus: {
      type: "object",
      properties: {
        redis: { type: "string" },
        subscriber: { type: "string" },
        circuitOpen: { type: "boolean" },
      },
    },
  },
  required: ["code", "ready", "redis", "redisStatus"],
};

export async function sessionRoutes(server: FastifyInstance) {
  server.post(
    "/api/sessions",
    {
      schema: {
        summary: "Create a new session",
        description: "Creates a session and returns a session code with expiration time.",
        body: createSessionBodyJsonSchema,
        response: {
          201: sessionCreatedResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
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
    },
  );

  server.get(
    "/api/sessions/:code",
    {
      schema: {
        summary: "Get session status",
        description: "Returns whether the session code exists and whether Redis is connected.",
        params: {
          type: "object",
          properties: {
            code: { type: "string", example: "IiCA_hJePx" },
          },
          required: ["code"],
        },
        response: {
          200: sessionStatusResponseJsonSchema,
          503: sessionStatusResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const group = getSessionGroupName(code);
      const streamKey = getSessionStreamKey(code);

      try {
        await ensureConsumerGroup(streamKey, group);
      } catch (error) {
        return reply.status(503).send({
          code,
          ready: false,
          redis: false,
          redisStatus: getRedisStatus(),
        });
      }

      return reply.send({
        code,
        ready: true,
        redis: redisIsConnected(),
        redisStatus: getRedisStatus(),
      });
    },
  );

  server.register(async (instance) => {
    instance.get("/ws/session/:code", { websocket: true }, (connection, request) => {
      const { code } = request.params as { code: string };
      const channel = getSessionChannel(code);
      const group = getSessionGroupName(code);
      const streamKey = getSessionStreamKey(code);

      let unsubscribe: (() => Promise<void>) | undefined;
      let closing = false;

      const sendJson = (payload: unknown) => {
        if (connection.readyState === 1) {
          connection.send(JSON.stringify(payload));
        }
      };

      const cleanup = async () => {
        if (closing) return;
        closing = true;
        if (unsubscribe) {
          await unsubscribe();
          unsubscribe = undefined;
        }
      };

      subscribeSessionChannel(code, (event: Record<string, unknown>) => {
        sendJson({ type: "session.event", event });
      })
        .then((unsub: () => Promise<void>) => {
          unsubscribe = unsub;
        })
        .catch(() => {
          sendJson({ type: "session.error", message: "Unable to subscribe to session channel." });
          connection.close();
        });

      connection.on("message", async (message: unknown) => {
        try {
          const payload = JSON.parse((message as any).toString());
          const parsed = textUpdatePayloadSchema.safeParse(payload);

          if (!parsed.success) return;

          const event = {
            type: "session.text.update",
            code,
            data: parsed.data.data,
            sender: (request.headers["x-forwarded-for"] || request.ip || "unknown") as string,
            createdAt: new Date().toISOString(),
          };

          await addSessionStreamEvent(code, event);
          await publishSessionEvent(code, event);
        } catch {
          // ignore invalid JSON or Redis failures
        }
      });

      connection.on("close", cleanup);
      connection.on("error", cleanup);

      if (!redisIsConnected()) {
        sendJson({ type: "session.error", message: "Redis is not available." });
      }
    });
  });
}
