import { prisma } from '@wa/db';
import { InsufficientBalanceError, formatRupees, rupees } from '@wa/billing';
import { ApiError } from './errors';
import { chargeWallet } from './wallet';

export interface Plan {
  key: string;
  name: string;
  /** Rupees per month */
  price: string;
  /** Shopify/WooCommerce messages, COD confirmation and cart reminders */
  storeAutomations: boolean;
  features: string[];
}

/** Edit freely. Per-message fees come from the Rate table; plans without their own rates use the free plan's. */
export const PLANS: Plan[] = [
  {
    key: 'starter',
    name: 'Free',
    price: '0',
    storeAutomations: false,
    features: ['OTP and order update API', 'Promotions to your contacts', 'Pay only for delivered messages'],
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '999',
    storeAutomations: true,
    features: ['Everything in Free', 'Shopify and WooCommerce auto-messages', 'Cash-on-delivery confirmation', 'Abandoned cart reminders'],
  },
];

export const planOf = (key: string) => PLANS.find((p) => p.key === key) ?? PLANS[0]!;

const addMonth = (date: Date) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
};

const toFree = (orgId: string) =>
  prisma.organization.update({ where: { id: orgId }, data: { plan: 'starter', planRenewsAt: null, planCancelled: false } });

/** Upgrades charge the first month from the wallet now. Moving to Free takes effect at the renewal date. */
export async function changePlan(orgId: string, key: string) {
  const plan = PLANS.find((p) => p.key === key);
  if (!plan) throw new ApiError(400, 'unknown_plan', 'Unknown plan');
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
  const current = planOf(org.plan);

  if (plan.key === current.key) {
    await prisma.organization.update({ where: { id: orgId }, data: { planCancelled: false } });
    return `You’re on the ${plan.name} plan.`;
  }
  if (rupees(plan.price) === 0) {
    await prisma.organization.update({ where: { id: orgId }, data: { planCancelled: true } });
    const until = org.planRenewsAt?.toLocaleDateString('en-IN', { dateStyle: 'medium' }) ?? 'the end of this month';
    return `Your ${current.name} plan stays active until ${until}, then you move to ${plan.name}.`;
  }

  try {
    await chargeWallet(orgId, rupees(plan.price), `${plan.name} plan`);
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      throw new ApiError(402, 'insufficient_balance', `The ${plan.name} plan costs ${formatRupees(rupees(plan.price))}/month. Recharge your wallet first.`);
    }
    throw err;
  }
  await prisma.organization.update({
    where: { id: orgId },
    data: { plan: plan.key, planCancelled: false, planRenewsAt: addMonth(new Date()) },
  });
  return `You’re now on the ${plan.name} plan.`;
}

/** Daily: renew due paid plans from the wallet; cancelled or unpaid ones drop to Free. */
export async function renewPlans(now = new Date()) {
  const due = await prisma.organization.findMany({ where: { plan: { not: 'starter' }, planRenewsAt: { lte: now } } });
  for (const org of due) {
    if (org.planCancelled) {
      await toFree(org.id);
      continue;
    }
    // Claim the renewal first so overlapping cron runs can't charge twice.
    const { count } = await prisma.organization.updateMany({
      where: { id: org.id, planRenewsAt: org.planRenewsAt },
      data: { planRenewsAt: addMonth(org.planRenewsAt!) },
    });
    if (!count) continue;
    const plan = planOf(org.plan);
    try {
      await chargeWallet(org.id, rupees(plan.price), `${plan.name} plan renewal`);
    } catch (err) {
      if (!(err instanceof InsufficientBalanceError)) throw err;
      await toFree(org.id);
    }
  }
}
