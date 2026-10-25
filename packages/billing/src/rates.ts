import type { BillingMode, MessageCategory } from '@wa/shared';
import type { Micros } from './money';

export interface Rate {
  plan: string;
  category: MessageCategory;
  /** Recipient country (ISO alpha-2) or '*' for any. */
  country: string;
  billingMode: BillingMode;
  effectiveFrom: Date;
  /** What we charge the seller per billable delivered message. */
  priceMicros: Micros;
  /** What Meta charges us. Always 0 in DIRECT_META, where Meta bills the seller. */
  metaCostMicros: Micros;
}

export interface RateQuery {
  plan: string;
  category: MessageCategory;
  country: string;
  billingMode: BillingMode;
  at: Date;
}

export class NoRateError extends Error {
  constructor(readonly query: RateQuery) {
    super(`No rate for ${query.plan}/${query.category}/${query.country}/${query.billingMode}`);
    this.name = 'NoRateError';
  }
}

/** An exact country beats '*'; among equally specific rates the latest one in effect wins. */
export function resolveRate(rates: readonly Rate[], query: RateQuery): Rate {
  let best: Rate | undefined;
  for (const rate of rates) {
    if (rate.plan !== query.plan || rate.category !== query.category) continue;
    if (rate.billingMode !== query.billingMode || rate.effectiveFrom > query.at) continue;
    if (rate.country !== query.country && rate.country !== '*') continue;
    if (!best) {
      best = rate;
      continue;
    }
    const specific = Number(rate.country !== '*') - Number(best.country !== '*');
    if (specific > 0 || (specific === 0 && rate.effectiveFrom > best.effectiveFrom)) best = rate;
  }
  if (!best) throw new NoRateError(query);
  return best;
}
