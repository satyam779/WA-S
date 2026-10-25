import { prisma } from '@wa/db';

export const dynamic = 'force-dynamic';

/** For uptime monitors: 200 when the app can reach the database, 503 when it can't. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Health check failed', err);
    return Response.json({ ok: false }, { status: 503 });
  }
}
