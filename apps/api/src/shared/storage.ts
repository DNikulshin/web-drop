import fs from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const UPLOAD_DIR = path.join(process.cwd(), "apps/api/data/uploads");
const USE_S3 = process.env.USE_S3 === "1" || process.env.USE_S3 === "true";
const S3_BUCKET = process.env.S3_BUCKET || "";

let s3Client: S3Client | null = null;
if (USE_S3) {
  s3Client = new S3Client({ region: process.env.AWS_REGION });
}

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveFileLocal(code: string, buffer: Buffer, meta: Record<string, unknown>) {
  const filePath = path.join(UPLOAD_DIR, code);
  const metaPath = path.join(UPLOAD_DIR, `${code}.meta.json`);
  await fs.writeFile(filePath, buffer);
  await fs.writeFile(metaPath, JSON.stringify(meta));
}

export async function saveFileS3(code: string, buffer: Buffer, meta: Record<string, unknown>) {
  if (!s3Client || !S3_BUCKET) throw new Error("S3 not configured");
  await s3Client.send(
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: code, Body: buffer, Metadata: { filename: String(meta.filename || code) } }),
  );
  await fs.writeFile(path.join(UPLOAD_DIR, `${code}.meta.json`), JSON.stringify(meta));
}

export async function deleteFile(code: string) {
  const filePath = path.join(UPLOAD_DIR, code);
  const metaPath = path.join(UPLOAD_DIR, `${code}.meta.json`);
  try {
    if (USE_S3 && s3Client && S3_BUCKET) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: code }));
        await fs.unlink(metaPath).catch(() => {});
        return { code, s3: true, success: true };
      } catch (err: any) {
        return { code, s3: true, success: false, error: String(err.message ?? err) };
      }
    } else {
      try {
        await fs.unlink(filePath).catch(() => {});
        await fs.unlink(metaPath).catch(() => {});
        return { code, s3: false, success: true };
      } catch (err: any) {
        return { code, s3: false, success: false, error: String(err.message ?? err) };
      }
    }
  } catch (err: any) {
    return { code, s3: USE_S3 === true, success: false, error: String(err.message ?? err) };
  }
}

export async function readFile(code: string) {
  const filePath = path.join(UPLOAD_DIR, code);
  if (USE_S3 && s3Client && S3_BUCKET) {
    const out = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: code }));
    // @ts-ignore
    const stream = out.Body;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  return fs.readFile(filePath);
}

export async function readMeta(code: string) {
  const metaPath = path.join(UPLOAD_DIR, `${code}.meta.json`);
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function listExpired() {
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
