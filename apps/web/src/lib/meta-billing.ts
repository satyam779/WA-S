import { unstable_cache } from 'next/cache';
import { prisma } from '@wa/db';
import { formatRupees } from '@wa/billing';
import { META_ERROR } from '@wa/meta';
import { graphFor } from './meta';

/** Meta's pricing categories, in words customers know. */
const CATEGORY: Record<string, string> = {
  AUTHENTICATION: 'OTP and login codes',
  AUTHENTICATION_INTERNATIONAL: 'OTPs to other countries',
  UTILITY: 'Order updates and reminders',
  MARKETING: 'Promotions',
  MARKETING_LITE: 'Promotions',
  SERVICE: 'Replies to customers',
};

export interface MetaCharges {
  currency: string;
  /** The business Meta bills; its Billing & payments page is where the customer pays. */
  owner: { id: string; name: string } | null;
  /** Micros of `currency`, from the start of this month in India until now. */
  total: number;
  volume: number;
  rows: { label: string; volume: number; cost: number }[];
  /** Meta reports no working payment method on the account. */
  paymentMissing: boolean;
  /** Other reasons Meta gives for limiting or blocking messages, such as business verification. */
  problems: string[];
}

/** What Meta has charged a connected account since `from`. Cached for 15 minutes: Meta's numbers trail a little anyway. */
export const metaCharges = unstable_cache(
  async (wabaId: string, from: string): Promise<MetaCharges> => {
    const waba = await prisma.waba.findUniqueOrThrow({ where: { id: wabaId } });
    const billing = await graphFor(waba).getBilling(waba.metaWabaId, new Date(from), new Date());
    const byLabel = new Map<string, { volume: number; cost: number }>();
    for (const point of billing.pricing) {
      const category = point.pricing_category ?? 'OTHER';
      const label = CATEGORY[category] ?? category.charAt(0) + category.slice(1).toLowerCase().replace(/_/g, ' ');
      const row = byLabel.get(label) ?? { volume: 0, cost: 0 };
      row.volume += point.volume ?? 0;
      // Meta sends decimal amounts; keep integer micros from here on.
      row.cost += Math.round((point.cost ?? 0) * 1_000_000);
      byLabel.set(label, row);
    }
    const rows = [...byLabel].map(([label, r]) => ({ label, ...r })).sort((a, b) => b.cost - a.cost || b.volume - a.volume);
    const errors = billing.health_status?.entities.flatMap((e) => e.errors ?? []) ?? [];
    return {
      currency: billing.currency ?? waba.currency ?? 'INR',
      owner: billing.owner_business_info ? { id: billing.owner_business_info.id, name: billing.owner_business_info.name } : null,
      total: rows.reduce((sum, r) => sum + r.cost, 0),
      volume: rows.reduce((sum, r) => sum + r.volume, 0),
      rows,
      paymentMissing: errors.some((e) => e.error_code === META_ERROR.noPaymentMethod),
      problems: errors.filter((e) => e.error_code !== META_ERROR.noPaymentMethod).map((e) => e.error_description),
    };
  },
  ['meta-charges'],
  { revalidate: 900 },
);

export const formatMetaAmount = (micros: number, currency: string) =>
  currency === 'INR' ? formatRupees(micros) : `${currency} ${(micros / 1_000_000).toFixed(2)}`;

/** Meta's Billing & payments page, opened on the business that pays. Payment for WhatsApp messages can only be made there. */
export const metaBillingUrl = (ownerId?: string) => `https://business.facebook.com/billing_hub/accounts${ownerId ? `?business_id=${ownerId}` : ''}`;
