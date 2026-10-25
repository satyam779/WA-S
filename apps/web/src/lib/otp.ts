import { randomUUID, timingSafeEqual } from 'node:crypto';
import { prisma } from '@wa/db';
import { OTP_TEMPLATE_NAME, otpMessage } from '@wa/meta';
import { parseMsisdn } from '@wa/shared';
import { numericCode, otpHash } from './crypto';
import { ApiError } from './errors';
import { sendMessage } from './send';

const RESEND_GAP_MS = 30_000;
const MAX_PER_HOUR = 5;

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value ?? fallback);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export async function sendOtp(orgId: string, input: { phone?: string; length?: number; expiry?: number }) {
  const phone = parseMsisdn(String(input.phone ?? ''));
  if (!phone) throw new ApiError(400, 'invalid_phone', `Invalid phone number: ${input.phone}`);
  const length = clamp(input.length, 4, 8, 6);
  const expirySeconds = clamp(input.expiry, 60, 1800, 600);

  const recent = await prisma.otpRequest.findMany({
    where: { orgId, phone: phone.digits, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (recent.length >= MAX_PER_HOUR) throw new ApiError(429, 'rate_limited', 'Too many OTPs to this number in the last hour');
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_GAP_MS) {
    throw new ApiError(429, 'rate_limited', 'Wait 30 seconds before sending another OTP to this number');
  }

  const id = randomUUID();
  const code = numericCode(length);
  const message = await sendMessage(orgId, {
    to: phone.digits,
    template: { name: OTP_TEMPLATE_NAME, language: 'en_US', components: otpMessage(phone.digits, code).template!.components },
  });
  const otp = await prisma.otpRequest.create({
    data: {
      id,
      orgId,
      phone: phone.digits,
      codeHash: otpHash(id, code).toString('hex'),
      expiresAt: new Date(Date.now() + expirySeconds * 1000),
      messageId: message.id,
    },
  });
  return { requestId: otp.id, messageId: message.id, expiresAt: otp.expiresAt };
}

export async function verifyOtp(orgId: string, input: { requestId?: string; phone?: string; code?: string }) {
  const code = String(input.code ?? '').trim();
  if (!/^\d{4,8}$/.test(code)) throw new ApiError(400, 'invalid_code', '`code` must be 4–8 digits');

  const phone = input.phone ? parseMsisdn(String(input.phone))?.digits : undefined;
  if (!input.requestId && !phone) throw new ApiError(400, 'invalid_request', 'Pass `requestId` or `phone`');
  const otp = await prisma.otpRequest.findFirst({
    where: input.requestId ? { id: String(input.requestId), orgId } : { orgId, phone, verifiedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) return { verified: false, reason: 'not_found' };
  if (otp.verifiedAt) return { verified: false, reason: 'already_verified' };
  if (otp.expiresAt < new Date()) return { verified: false, reason: 'expired' };

  // Count the attempt atomically before comparing, so parallel guesses can't exceed the limit.
  const { count } = await prisma.otpRequest.updateMany({
    where: { id: otp.id, verifiedAt: null, attempts: { lt: otp.maxAttempts } },
    data: { attempts: { increment: 1 } },
  });
  if (!count) return { verified: false, reason: 'too_many_attempts' };

  if (!timingSafeEqual(otpHash(otp.id, code), Buffer.from(otp.codeHash, 'hex'))) {
    return { verified: false, reason: 'invalid_code', attemptsLeft: Math.max(0, otp.maxAttempts - otp.attempts - 1) };
  }
  const marked = await prisma.otpRequest.updateMany({ where: { id: otp.id, verifiedAt: null }, data: { verifiedAt: new Date() } });
  return marked.count ? { verified: true } : { verified: false, reason: 'already_verified' };
}
