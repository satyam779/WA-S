import { formatRupees, rupees } from '@wa/billing';
import type { BillingMode } from '@wa/shared';
import { META_PRICE_INR } from './use-cases';
import { priceFor } from './wallet';

type Priced = keyof typeof META_PRICE_INR;

const MESSAGE_TYPES: { category: Priced; label: string; short: string }[] = [
  { category: 'AUTHENTICATION', label: 'OTP and login codes', short: 'OTPs' },
  { category: 'UTILITY', label: 'Order updates and reminders', short: 'Updates' },
  { category: 'MARKETING', label: 'Promotions', short: 'Promotions' },
];

export interface PriceRow {
  label: string;
  /** For tight spaces such as tabs. */
  short: string;
  /** Our price per delivered message to an Indian number, in micros; null when no rate is set. */
  ours: number | null;
  /** Meta's own fee, which Meta bills to the customer. Null on our credit line, where `ours` includes it. */
  meta: number | null;
}

/** The price table shown on the Wallet and Help pages. */
export async function priceRows(plan: string, billingMode: BillingMode = 'DIRECT_META'): Promise<PriceRow[]> {
  return Promise.all(
    MESSAGE_TYPES.map(async ({ category, label, short }) => ({
      label,
      short,
      ours: await priceFor(plan, category, 'IN', billingMode).then((p) => Number(p.price), () => null),
      meta: billingMode === 'CREDIT_LINE' ? null : rupees(META_PRICE_INR[category]),
    })),
  );
}

/** What a customer pays per message, as shown in the dashboard. */
export async function priceLabels(plan: string, billingMode: BillingMode = 'DIRECT_META') {
  const label = async (category: Priced) => {
    try {
      const ours = formatRupees((await priceFor(plan, category, 'IN', billingMode)).price);
      return billingMode === 'CREDIT_LINE'
        ? `${ours} per delivered message, all-inclusive`
        : `${ours} per delivered message + Meta’s ₹${META_PRICE_INR[category]} (billed by Meta)`;
    } catch {
      return 'Price not set';
    }
  };
  const [AUTHENTICATION, UTILITY, MARKETING] = await Promise.all([label('AUTHENTICATION'), label('UTILITY'), label('MARKETING')]);
  return { AUTHENTICATION, UTILITY, MARKETING };
}
