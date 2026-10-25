import { formatRupees } from '@wa/billing';
import type { BillingMode } from '@wa/shared';
import { META_PRICE_INR } from './use-cases';
import { priceFor } from './wallet';

type Priced = keyof typeof META_PRICE_INR;

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
