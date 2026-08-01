import { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "apps/api/data/uploads");

export async function filesRoutes(server: FastifyInstance) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  server.post(
    "/api/files",
    {
      schema: {
        summary: "Upload a file (base64 payload)",
        body: {
          type: "object",
          properties: {
            filename: { type: "string" },
            content: { type: "string", description: "Base64-encoded file content" },
            ttlSeconds: { type: "integer" },
          },
          required: ["filename", "content"],
        },
        response: {
          201: {
            type: "object",
            properties: {
              code: { type: "string" },
              url: { type: "string" },
              expiresAt: { type: "string", format: "date-time" },
            },
            required: ["code", "url", "expiresAt"],
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { filename: string; content: string; ttlSeconds?: number };
      const code = nanoid(8);
      const filePath = path.join(UPLOAD_DIR, code);
      const metaPath = path.join(UPLOAD_DIR, `${code}.meta.json`);

      try {
        const buffer = Buffer.from(body.content, "base64");
        await fs.writeFile(filePath, buffer);
        const ttl = body.ttlSeconds ?? 60 * 60 * 24; // default 1 day
        const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
        const meta = { filename: body.filename, size: buffer.length, expiresAt };
        await fs.writeFile(metaPath, JSON.stringify(meta));

        const url = `/files/${code}`;
        return reply.status(201).send({ code, url, expiresAt });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: "Internal Server Error", message: "Unable to save file" });
      }
    },
  );

  server.get(
    "/files/:code",
    {
      schema: {
        params: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const filePath = path.join(UPLOAD_DIR, code);
      const metaPath = path.join(UPLOAD_DIR, `${code}.meta.json`);

      try {
        const [fileStat] = await Promise.all([fs.stat(filePath).catch(() => null)]);
        if (!fileStat) {
          return reply.status(404).send({ status: "error", message: "File not found" });
        }

        const metaRaw = await fs.readFile(metaPath, "utf-8").catch(() => null);
        const meta = metaRaw ? JSON.parse(metaRaw) : { filename: code };

        const stream = await fs.readFile(filePath);
        reply.header("content-disposition", `attachment; filename="${meta.filename}"`);
        return reply.send(stream);
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: "Internal Server Error", message: "Unable to read file" });
      }
    },
  );
}
