import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { env } from './env';

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const numericCode = (length: number) => String(randomInt(0, 10 ** length)).padStart(length, '0');

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  return timingSafeEqual(await scrypt(password, Buffer.from(salt, 'base64'), expected.length), expected);
}

/** Keyed hash for OTP codes, so a database leak doesn't reveal live codes. */
export const otpHash = (requestId: string, code: string) =>
  createHmac('sha256', env.otpHashSecret).update(`${requestId}:${code}`).digest();

/** AES-256-GCM for secrets we must read back (registration PINs). */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', env.encryptionKey, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.');
}

export function decrypt(sealed: string) {
  const [iv, tag, data] = sealed.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', env.encryptionKey, iv!);
  decipher.setAuthTag(tag!);
  return Buffer.concat([decipher.update(data!), decipher.final()]).toString('utf8');
}
