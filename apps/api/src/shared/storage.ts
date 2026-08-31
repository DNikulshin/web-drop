import fs from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@web-drop/db";
import { redis } from "./lib/redis.js";

const cwd = process.cwd();
const UPLOAD_DIR = cwd.endsWith(path.join("apps", "api"))
  ? path.join(cwd, "data", "uploads")
  : path.join(cwd, "apps", "api", "data", "uploads");
function isUseS3() {
  return process.env.USE_S3 === "1" || process.env.USE_S3 === "true";
}
function getS3Bucket() {
  return process.env.S3_BUCKET || "";
}

let s3Client: S3Client | null = null;
if (isUseS3()) {
  s3Client = new S3Client({ region: process.env.AWS_REGION });
}

export function setS3Client(client: S3Client | null) {
  s3Client = client;
}

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveFileLocal(code: string, buffer: Buffer, meta: Record<string, unknown>) {
  const filePath = path.join(UPLOAD_DIR, code);
  const metaPath = path.join(UPLOAD_DIR, `${code}.meta.json`);
  await fs.writeFile(filePath, buffer);
  await fs.writeFile(metaPath, JSON.stringify(meta));
  await prisma.file.create({
    data: {
      code,
      filename: String(meta.filename || code),
      size: buffer.length,
      expiresAt: new Date(meta.expiresAt as string),
      sessionId: null,
    },
  }).catch((err) => {
    console.error("Failed to save file metadata to Postgres", { code, err });
  });
}

export async function saveFileS3(code: string, buffer: Buffer, meta: Record<string, unknown>) {
  const S3_BUCKET = getS3Bucket();
  if (!s3Client || !S3_BUCKET) throw new Error("S3 not configured");
  await s3Client.send(
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: code, Body: buffer, Metadata: { filename: String(meta.filename || code) } }),
  );
  await prisma.file.create({
    data: {
      code,
      filename: String(meta.filename || code),
      size: buffer.length,
      expiresAt: new Date(meta.expiresAt as string),
      sessionId: null,
    },
  }).catch((err) => {
    console.error("Failed to save file metadata to Postgres", { code, err });
    throw new Error("Unable to save file metadata");
  });
}

export async function deleteFile(code: string) {
  const filePath = path.join(UPLOAD_DIR, code);
  const metaPath = path.join(UPLOAD_DIR, `${code}.meta.json`);
  try {
    const S3_BUCKET = getS3Bucket();
    if (isUseS3() && s3Client && S3_BUCKET) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: code }));
        await prisma.file.delete({ where: { code } }).catch(() => {});
        return { code, s3: true, success: true };
      } catch (err: any) {
        return { code, s3: true, success: false, error: String(err.message ?? err) };
      }
    } else {
      try {
        await fs.unlink(filePath).catch(() => {});
        await fs.unlink(metaPath).catch(() => {});
        await prisma.file.delete({ where: { code } }).catch(() => {});
        return { code, s3: false, success: true };
      } catch (err: any) {
        return { code, s3: false, success: false, error: String(err.message ?? err) };
      }
    }
  } catch (err: any) {
    return { code, s3: isUseS3() === true, success: false, error: String(err.message ?? err) };
  }
}

export async function readFile(code: string) {
  const filePath = path.join(UPLOAD_DIR, code);
  const S3_BUCKET = getS3Bucket();
  if (isUseS3() && s3Client && S3_BUCKET) {
    const out = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: code }));
    // Body can be a stream/async iterable — coerce and guard
    // @ts-ignore
    const stream = out.Body as AsyncIterable<Uint8Array> | undefined;
    if (!stream) throw new Error('S3 object has empty body');
    const chunks: Buffer[] = [];
    // stream might not have correct TS type; iterate as any
    for await (const chunk of stream as any) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  return fs.readFile(filePath);
}

export async function readMeta(code: string) {
  if (isUseS3()) {
    try {
      const file = await prisma.file.findUnique({ where: { code } });
      return file ? { filename: file.filename, size: file.size, expiresAt: file.expiresAt.toISOString() } : null;
    } catch {
      return null;
    }
  }

  const metaPath = path.join(UPLOAD_DIR, `${code}.meta.json`);
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function listExpired() {
  if (isUseS3()) {
    const expired = await prisma.file.findMany({
      where: { expiresAt: { lt: new Date() } },
      select: { code: true },
    });
    return expired.map(f => f.code);
  }

  await ensureUploadDir();
  const files = await fs.readdir(UPLOAD_DIR);
  const expired: string[] = [];
  for (const f of files) {
    if (!f.endsWith(".meta.json")) continue;
    const code = f.replace(/\.meta\.json$/, "");
    const meta = await readMeta(code);
    if (!meta) continue;
    if (meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) {
      expired.push(code);
    }
  }
  return expired;
}
