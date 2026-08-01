import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { filesRoutes } from "./files.routes";

function base64(str: string) {
  return Buffer.from(str).toString("base64");
}

describe("Files routes", () => {
  it("should upload and download a file", async () => {
    const server = Fastify();
    await server.register(filesRoutes);

    const payload = { filename: "hello.txt", content: base64("hello world"), ttlSeconds: 60 };
    const res = await server.inject({ method: "POST", url: "/api/files", payload });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty("code");
    expect(body).toHaveProperty("url");

    const download = await server.inject({ method: "GET", url: body.url });
    expect(download.statusCode).toBe(200);
    expect(download.body).toBe("hello world");

    await server.close();
  });
});
