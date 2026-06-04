import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton.
 *
 * In dev, Next.js hot-reload can create multiple clients. We cache on globalThis
 * to avoid exhausting the database connection pool.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
