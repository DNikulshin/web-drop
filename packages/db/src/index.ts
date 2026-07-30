import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// 👇 ЭТА СТРОКА ОБЯЗАТЕЛЬНА ДЛЯ СКВОЗНОЙ ТИПИЗАЦИИ
export * from "./generated/prisma";
