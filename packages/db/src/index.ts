import { PrismaClient } from '@prisma/client';

// One client per process; Next.js dev reloads modules, so keep it on globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
