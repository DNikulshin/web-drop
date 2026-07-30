import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Явно загружаем .env из корня монорепозитория (на 2 уровня выше)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
