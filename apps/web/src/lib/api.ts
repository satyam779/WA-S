import { NextResponse } from 'next/server';
import { prisma } from '@wa/db';
import { sha256 } from './crypto';
import { ApiError } from './errors';

async function authenticate(req: Request) {
  const header = req.headers.get('authorization');
  const key = header?.startsWith('Bearer ') ? header.slice(7).trim() : req.headers.get('x-api-key');
  if (!key) throw new ApiError(401, 'unauthorized', 'Missing API key');
  const apiKey = await prisma.apiKey.findUnique({ where: { hash: sha256(key) } });
  if (!apiKey || apiKey.revokedAt) throw new ApiError(401, 'unauthorized', 'Invalid API key');
  void prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return apiKey.orgId;
}

type Handler = (orgId: string, body: Record<string, any>, params: Record<string, string>) => Promise<unknown>;

/** Public v1 route: API-key auth, JSON in and out, ApiError mapped to `{ error: { code, message } }`. */
export function apiRoute(handler: Handler) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const orgId = await authenticate(req);
      let body: Record<string, any> = {};
      if (req.method !== 'GET') {
        body = await req.json().catch(() => {
          throw new ApiError(400, 'invalid_json', 'Request body must be JSON');
        });
      }
      return NextResponse.json(await handler(orgId, body ?? {}, await ctx.params));
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
      }
      console.error(err);
      return NextResponse.json({ error: { code: 'internal', message: 'Internal error' } }, { status: 500 });
    }
  };
}
