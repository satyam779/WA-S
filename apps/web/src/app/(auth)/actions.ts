'use server';

import { redirect } from 'next/navigation';
import { Prisma, prisma } from '@wa/db';
import { rupees } from '@wa/billing';
import type { ActionResult } from '@/components/action-form';
import { createSession, destroySession, forgetLogins } from '@/lib/auth';
import { hashPassword, randomToken, sha256, verifyPassword } from '@/lib/crypto';
import { emailConfigured, sendEmail } from '@/lib/email';
import { BRAND, SITE, env } from '@/lib/env';
import { creditWallet } from '@/lib/wallet';

const field = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const MAX_FAILED_LOGINS = 10;
const LOCK_MS = 15 * 60_000;
const RESET_MS = 30 * 60_000;
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(64).toString('base64')}`;

export async function signupAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const name = field(data, 'name');
  const company = field(data, 'company');
  const email = field(data, 'email').toLowerCase();
  const password = String(data.get('password') ?? '');
  if (!name || !company || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Fill in every field with a valid email' };
  if (password.length < 8) return { error: 'Use at least 8 characters for the password' };
  if (data.get('terms') !== 'on') return { error: 'Please accept the Terms and Privacy Policy' };
  if (await prisma.user.findUnique({ where: { email } })) return { error: 'An account with this email already exists. Log in instead.' };

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        org: { create: { name: company, wallet: { create: {} } } },
      },
    });
  } catch (err) {
    // Two signups with the same email at the same moment
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { error: 'An account with this email already exists. Log in instead.' };
    }
    throw err;
  }
  const bonus = rupees(env.signupBonusRupees);
  if (bonus > 0) await creditWallet(user.orgId, bonus, 'promo', 'Signup bonus');
  await createSession(user.id);
  redirect('/dashboard');
}

export async function loginAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const password = String(data.get('password') ?? '');
  const user = await prisma.user.findUnique({ where: { email: field(data, 'email').toLowerCase() } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return { error: 'Too many wrong passwords. Try again in 15 minutes, or reset your password.' };
  }
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    if (!user) await verifyPassword(password, DUMMY_HASH);
    else {
      const { failedLogins } = await prisma.user.update({ where: { id: user.id }, data: { failedLogins: { increment: 1 } } });
      if (failedLogins >= MAX_FAILED_LOGINS) {
        await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } });
      }
    }
    return { error: 'Wrong email or password' };
  }
  if (user.failedLogins || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  }
  await createSession(user.id);
  redirect('/dashboard');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}

export async function requestResetAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  // Without an email service the link only reaches the server log, so don't promise an email.
  if (process.env.VERCEL && !emailConfigured()) {
    return { error: `Password reset emails aren’t set up yet. Email ${SITE.supportEmail} and we’ll help you get back in.` };
  }
  const email = field(data, 'email').toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  const recent = user
    ? await prisma.passwordReset.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } } })
    : 0;
  if (user && recent < 3) {
    const token = randomToken();
    await prisma.passwordReset.create({ data: { id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_MS) } });
    const link = `${SITE.url}/reset-password?token=${token}`;
    await sendEmail(
      email,
      `Reset your ${BRAND} password`,
      `<p>Hi ${escapeHtml(user.name)},</p><p>Click the link below to choose a new password. It works for 30 minutes.</p><p><a href="${link}">${link}</a></p><p>If you didn't ask for this, you can ignore this email.</p>`,
    );
  }
  // Same answer either way, so this form can't be used to find out who has an account.
  return { ok: 'If an account exists for that email, we’ve sent a reset link. Check your inbox.' };
}

export async function resetPasswordAction(_: ActionResult, data: FormData): Promise<ActionResult> {
  const password = String(data.get('password') ?? '');
  if (password.length < 8) return { error: 'Use at least 8 characters for the password' };
  if (password !== String(data.get('confirm') ?? '')) return { error: 'The two passwords don’t match' };

  const reset = await prisma.passwordReset.findUnique({ where: { id: sha256(field(data, 'token')) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return { error: 'This reset link has expired or was already used. Ask for a new one.' };
  }
  const [, user] = await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null },
    }),
    // Log out every other device.
    prisma.session.deleteMany({ where: { userId: reset.userId } }),
  ]);
  forgetLogins(user.orgId);
  await createSession(reset.userId);
  redirect('/dashboard');
}
