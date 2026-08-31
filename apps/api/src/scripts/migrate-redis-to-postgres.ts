import dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "@web-drop/db";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config({ path: path.join(process.cwd(), ".env") });

console.log(
  "DATABASE_URL:",
  process.env.DATABASE_URL ? "✅ loaded" : "❌ NOT loaded",
);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not defined. Check .env file.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

import { redis } from "../shared/lib/redis.js";

// ... migrateSessions, migrateFiles, main (без изменений)

async function migrateSessions() {
  let cursor = "0";
  let count = 0;
  do {
    const [newCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      "session:*:meta",
    );
    cursor = newCursor;

    for (const key of keys) {
      const code = key.replace(/^session:(.*):meta$/, "$1");
      const raw = await redis.get(key);
      if (!raw) continue;
      try {
        const meta = JSON.parse(raw);
        const existing = await prisma.session.findUnique({ where: { code } });
        if (existing) {
          console.log(`Session ${code} already exists, skipping`);
          continue;
        }
        await prisma.session.create({
          data: {
            code,
            createdAt: new Date(meta.createdAt),
            expiresAt: new Date(meta.expiresAt),
            ttlSeconds: meta.ttlSeconds ?? 86400,
          },
        });
        count++;
        console.log(`Migrated session ${code}`);
      } catch (err) {
        console.error(`Error migrating session ${code}:`, err);
      }
    }
  } while (cursor !== "0");
  console.log(`Total sessions migrated: ${count}`);
}

async function migrateFiles() {
  let cursor = "0";
  let count = 0;
  do {
    const [newCursor, keys] = await redis.scan(cursor, "MATCH", "file:*:meta");
    cursor = newCursor;

    for (const key of keys) {
      const code = key.replace(/^file:(.*):meta$/, "$1");
      const raw = await redis.get(key);
      if (!raw) continue;
      try {
        const meta = JSON.parse(raw);
        // Пока пропускаем файлы (этап 3)
        console.log(`File ${code} skipped (requires session relation)`);
      } catch (err) {
        console.error(`Error migrating file ${code}:`, err);
      }
    }
  } while (cursor !== "0");
  console.log(`Total files migrated: ${count}`);
}

async function main() {
  console.log("Starting migration from Redis to PostgreSQL...");
  await migrateSessions();
  await migrateFiles();
  console.log("Migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
