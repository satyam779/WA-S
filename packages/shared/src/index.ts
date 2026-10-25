import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export const MESSAGE_CATEGORIES = [
  'AUTHENTICATION',
  'AUTHENTICATION_INTERNATIONAL',
  'UTILITY',
  'MARKETING',
  'SERVICE',
] as const;
export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number];

/**
 * DIRECT_META: the seller pays Meta with their own card; we charge only our platform fee.
 * CREDIT_LINE: we pay Meta from our Solution Partner credit line and charge Meta's cost + markup.
 */
export const BILLING_MODES = ['DIRECT_META', 'CREDIT_LINE'] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export interface Msisdn {
  /** E.164 without the '+', the format the Cloud API uses for `to`. */
  digits: string;
  /** ISO 3166-1 alpha-2 of the recipient, 'ZZ' when unknown. Meta prices by this. */
  country: string;
}

/** Accepts "98765 43210", "+91 98765-43210", "919876543210" or "0091…". */
export function parseMsisdn(input: string, defaultCountry: CountryCode = 'IN'): Msisdn | null {
  const raw = input.trim().replace(/[\s().-]/g, '');
  const candidates = raw.startsWith('+')
    ? [raw]
    : raw.startsWith('00')
      ? [`+${raw.slice(2)}`]
      : [raw, `+${raw}`];
  for (const candidate of candidates) {
    const phone = parsePhoneNumberFromString(candidate, defaultCountry);
    if (phone?.isValid()) return { digits: phone.number.slice(1), country: phone.country ?? 'ZZ' };
  }
  return null;
}
