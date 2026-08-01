import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

const rootEnvPath = path.resolve(__dirname, "../../.env");
const exampleEnvPath = path.resolve(__dirname, "../../.env.example");

dotenv.config({ path: exampleEnvPath });
dotenv.config({ path: rootEnvPath });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
