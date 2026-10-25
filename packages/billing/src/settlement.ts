import type { MessageCategory } from '@wa/shared';

/** The `pricing` object on a Cloud API status webhook. */
export interface StatusPricing {
  billable?: boolean;
  category?: string;
  type?: string;
  pricing_model?: string;
}

export type SettlementDecision =
  | { kind: 'wait' }
  | { kind: 'release' }
  | { kind: 'capture'; category: MessageCategory };

const CATEGORIES: Record<string, MessageCategory> = {
  authentication: 'AUTHENTICATION',
  authentication_international: 'AUTHENTICATION_INTERNATIONAL',
  utility: 'UTILITY',
  marketing: 'MARKETING',
  marketing_lite: 'MARKETING',
  service: 'SERVICE',
};

export const metaCategory = (raw: string): MessageCategory | undefined =>
  CATEGORIES[raw.toLowerCase().replace(/-/g, '_')];

/**
 * Meta bills per delivered message, and says on the status webhook whether it billed and in
 * which category (it may differ from the template's). Unbillable messages (free service
 * window, free entry point) and failures release the hold.
 */
export function decideSettlement(status: string, pricing?: StatusPricing): SettlementDecision {
  if (status === 'failed') return { kind: 'release' };
  if ((status !== 'delivered' && status !== 'read') || !pricing) return { kind: 'wait' };
  if (pricing.billable === false) return { kind: 'release' };
  const category = pricing.category ? metaCategory(pricing.category) : undefined;
  return category ? { kind: 'capture', category } : { kind: 'wait' };
}
