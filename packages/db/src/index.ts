import { PrismaClient } from '@prisma/client';

// One client per process; Next.js dev reloads modules, so keep it on globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// On a developer machine far from the database, Supabase's session pooler (DATABASE_URL_LOCAL) is
// several times faster. Vercel always uses DATABASE_URL (transaction pooler), so a pasted .env stays correct.
const localUrl = process.env.VERCEL ? undefined : process.env.DATABASE_URL_LOCAL;

export const prisma = globalForPrisma.prisma ?? new PrismaClient(localUrl ? { datasourceUrl: localUrl } : undefined);
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
