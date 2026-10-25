import { PrismaClient } from '@prisma/client';

// One client per process; Next.js dev reloads modules, so keep it on globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const SESSION_POOLER = /(\.pooler\.supabase\.com):5432\//;

// On a developer machine far from the database, Supabase's session pooler (DATABASE_URL_LOCAL) is
// several times faster. Vercel must use the transaction pooler (6543): the session pooler allows only
// 15 clients and serverless instances keep theirs open, so the live site soon can't connect.
function databaseUrl() {
  if (!process.env.VERCEL) return process.env.DATABASE_URL_LOCAL || undefined;
  const url = process.env.DATABASE_URL;
  if (!url || !SESSION_POOLER.test(url)) return undefined;
  const transaction = url.replace(SESSION_POOLER, '$1:6543/');
  return /[?&]pgbouncer=true/.test(transaction) ? transaction : `${transaction}${transaction.includes('?') ? '&' : '?'}pgbouncer=true`;
}

const url = databaseUrl();
export const prisma = globalForPrisma.prisma ?? new PrismaClient(url ? { datasourceUrl: url } : undefined);
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
