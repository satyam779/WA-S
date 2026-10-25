import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@wa/db';
import { randomToken, sha256 } from './crypto';

const COOKIE = 'wa_session';
const SESSION_MS = 30 * 86_400_000;
// Every dashboard request checks the login; remembering it briefly saves a database round trip per page.
const LOGIN_CACHE_MS = 30_000;

async function loadUser(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    relationLoadStrategy: 'join',
    include: { user: { include: { org: true } } },
  });
  return session && session.expiresAt > new Date() ? session.user : null;
}

type User = NonNullable<Awaited<ReturnType<typeof loadUser>>>;
const logins = new Map<string, { user: User; until: number }>();

/** Call after changing a user or their organisation (plan, password) so pages don't show stale data. */
export function forgetLogins(orgId: string) {
  for (const [id, entry] of logins) if (entry.user.orgId === orgId) logins.delete(id);
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await prisma.session.create({ data: { id: sha256(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    logins.delete(sha256(token));
    await prisma.session.deleteMany({ where: { id: sha256(token) } });
  }
  jar.delete(COOKIE);
}

export const getUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const hit = logins.get(id);
  if (hit && hit.until > Date.now()) return hit.user;

  const user = await loadUser(id);
  if (!user) {
    logins.delete(id);
    return null;
  }
  if (logins.size >= 5_000) logins.clear();
  logins.set(id, { user, until: Date.now() + LOGIN_CACHE_MS });
  return user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}
