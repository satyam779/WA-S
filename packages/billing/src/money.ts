/**
 * All money is integer micros: 1 INR = 1,000,000 micros. Paise are too coarse because
 * Meta's INR rates have four decimals (₹0.8631 = 86.31 paise).
 */
export type Micros = number;

export const MICROS_PER_RUPEE = 1_000_000;
export const MICROS_PER_PAISA = 10_000;
export const GST_RATE_BPS = 1_800;

export function assertMicros(value: number): asserts value is Micros {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Not an integer micro amount: ${value}`);
}

/** Parses a decimal rupee string ("0.8631") into micros without float rounding. */
export function rupees(value: string): Micros {
  const match = /^(-)?(\d+)(?:\.(\d{1,6}))?$/.exec(value.trim());
  if (!match) throw new RangeError(`Invalid rupee amount: ${value}`);
  const [, sign, whole = '0', frac = ''] = match;
  const micros = Number(whole) * MICROS_PER_RUPEE + Number(frac.padEnd(6, '0'));
  assertMicros(micros);
  return sign ? -micros : micros;
}

export function formatRupees(micros: Micros): string {
  const abs = Math.abs(micros);
  const frac = String(abs % MICROS_PER_RUPEE).padStart(6, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${micros < 0 ? '-' : ''}₹${Math.floor(abs / MICROS_PER_RUPEE)}.${frac}`;
}

/** Whole paise for payment gateways and invoices; rounds up so we never undercharge. */
export const toPaiseCeil = (micros: Micros): number => Math.ceil(micros / MICROS_PER_PAISA);
export const fromPaise = (paise: number): Micros => paise * MICROS_PER_PAISA;

export const gstOn = (micros: Micros, rateBps = GST_RATE_BPS): Micros =>
  Math.round((micros * rateBps) / 10_000);
