// `||` rather than `??`: an empty variable (e.g. `APP_URL=`) means "not set", not "blank".
export const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || 'WA Platform';

/** APP_URL, else the Vercel production domain. Tolerates a missing "https://" so a typo can't break the build. */
function siteUrl() {
  const raw = (process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000').trim().replace(/\/+$/, '');
  if (/^https?:\/\//.test(raw)) return raw;
  return `${raw.startsWith('localhost') ? 'http' : 'https'}://${raw}`;
}

/** Public details used on the website, in emails and in the legal pages. */
export const SITE = {
  url: siteUrl(),
  company: process.env.COMPANY_NAME || BRAND,
  supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

// Getters, so `next build` works without secrets and a missing one fails only where it's used.
export const env = {
  get metaAppSecret() {
    return required('META_APP_SECRET');
  },
  get metaVerifyToken() {
    return required('META_WEBHOOK_VERIFY_TOKEN');
  },
  get metaSystemUserToken() {
    return required('META_SYSTEM_USER_TOKEN');
  },
  get metaSystemUserId() {
    return required('META_SYSTEM_USER_ID');
  },
  /** Our business portfolio ID; sellers assign it as partner in WhatsApp Manager. */
  get metaBusinessId() {
    return required('META_BUSINESS_ID');
  },
  get metaGraphVersion() {
    return process.env.META_GRAPH_VERSION ?? 'v24.0';
  },
  get encryptionKey() {
    return Buffer.from(required('TOKEN_ENCRYPTION_KEY'), 'base64');
  },
  get otpHashSecret() {
    return required('OTP_HASH_SECRET');
  },
  get signupBonusRupees() {
    return process.env.SIGNUP_BONUS_RUPEES ?? '20';
  },
};
