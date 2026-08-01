import { z } from "zod";

export const createSessionBodySchema = z.object({
  ttlSeconds: z.number().int().positive().optional(),
});

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;

export const sessionCreatedResponseSchema = z.object({
  code: z.string(),
  expiresAt: z.string(),
});

export type SessionCreatedResponse = z.infer<typeof sessionCreatedResponseSchema>;

export const sessionEventMessageSchema = z.object({
  type: z.literal("session.event"),
  event: z.object({
    type: z.string(),
    code: z.string().optional(),
    data: z.unknown().optional(),
    sender: z.string().optional(),
    createdAt: z.string().optional(),
  }),
});

export type SessionEventMessage = z.infer<typeof sessionEventMessageSchema>;

export const textUpdatePayloadSchema = z.object({
  type: z.literal("session.text.update"),
  data: z.unknown().optional(),
});

export type TextUpdatePayload = z.infer<typeof textUpdatePayloadSchema>;
