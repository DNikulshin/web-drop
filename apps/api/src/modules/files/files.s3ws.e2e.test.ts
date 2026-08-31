import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { filesRoutes } from "./files.routes.js";
import { sessionRoutes } from "../session/session.routes.js";
import { setS3Client, listExpired, deleteFile } from "../../shared/storage.js";

import { Readable } from "stream";

// simple in-memory mock S3 client
function createMockS3() {
  const store = new Map();

  return {
    send: async (command: any) => {
      const name = command.constructor.name;
      if (name === "PutObjectCommand") {
        const Key = command.input.Key;
        let Body = command.input.Body;
        if (typeof Body === "string") Body = Buffer.from(Body);
        store.set(Key, {
          buffer: Buffer.from(Body),
          meta: command.input.Metadata || {},
        });
        return {};
      }
      if (name === "GetObjectCommand") {
        const Key = command.input.Key;
        const entry = store.get(Key);
        if (!entry) throw new Error("NotFound");
        return { Body: Readable.from([entry.buffer]) };
      }
      if (name === "DeleteObjectCommand") {
        return {};
      }
      return {};
    },
  };
}

describe("S3 + WebSocket E2E", () => {
  beforeEach(() => {
    process.env.USE_S3 = "true";
    process.env.S3_BUCKET = "test-bucket";
    process.env.AWS_REGION = "us-east-1";
    setS3Client(createMockS3() as any);
  });
  afterEach(() => {
    process.env.USE_S3 = "false";
    setS3Client(null);
  });

  it.skip("S3 upload -> download -> cleanup", async () => {
    const server = Fastify();
    await server.register(filesRoutes as any);

    const payload = {
      filename: "s3.txt",
      content: Buffer.from("s3-content").toString("base64"),
      ttlSeconds: 1,
    };
    const res = await server.inject({
      method: "POST",
      url: "/api/files",
      payload,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    const get1 = await server.inject({
      method: "GET",
      url: `/files/${body.code}`,
    });
    expect(get1.statusCode).toBe(200);
    expect(get1.body).toBe("s3-content");

    // Verify metadata exists in Redis
    const meta = await server.inject({
      method: "GET",
      url: `/api/files/${body.code}/meta`,
    });
    expect(meta.statusCode).toBe(200);
    expect(meta.json()).toMatchObject({ filename: "s3.txt" });
    await new Promise((r) => setTimeout(r, 1500));
    const expired = await listExpired();
    expect(expired).toContain(body.code);
    for (const code of expired) {
      await deleteFile(code);
    }

    const get2 = await server.inject({
      method: "GET",
      url: `/files/${body.code}`,
    });
    expect(get2.statusCode).toBe(404);

    // Verify metadata was deleted from Redis
    const metaAfter = await server.inject({
      method: "GET",
      url: `/api/files/${body.code}/meta`,
    });
    expect(metaAfter.statusCode).toBe(404);

    await server.close();
  }, 10000);

  it("WebSocket session sync (E2E)", async () => {
    const server = Fastify();
    await server.register(fastifyWebsocket as any);
    await server.register(sessionRoutes as any);

    await server.listen({ port: 0, host: "127.0.0.1" });
    const address = server.server.address();
    const port = (address as any).port;

    const createRes = await server.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {},
    });
    expect(createRes.statusCode).toBe(201);
    const { code } = createRes.json();
    expect(code).toBeTruthy();

    // open ws client
    const wsUrl = `ws://127.0.0.1:${port}/ws/session/${code}`;
    const WebSocket = (await import("ws")).default;

    const msg = await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => reject(new Error("timeout")), 2000);
      ws.on("open", () => {
        ws.send(
          JSON.stringify({ type: "session.text.update", data: "hello e2e" }),
        );
      });
      ws.on("message", (data) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString()));
        ws.close();
      });
      ws.on("error", reject);
    });

    expect(msg).toHaveProperty("type");
    expect((msg as any).type).toBe("session.event");

    await server.close();
  }, 10000);
});
