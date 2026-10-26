import Link from 'next/link';
import { Suspense } from 'react';
import { Check } from 'lucide-react';
import { prisma } from '@wa/db';
import { ACCOUNT, formatRupees } from '@wa/billing';
import { ActionForm } from '@/components/action-form';
import { MetaChargesSection } from '@/components/meta-charges';
import { CountUp } from '@/components/motion';
import { PriceTable } from '@/components/price-table';
import { Recharge } from '@/components/recharge';
import { PageHeader, SectionTitle, formatTime } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { BRAND } from '@/lib/env';
import { metaBillingUrl } from '@/lib/meta-billing';
import { rechargeEnabled } from '@/lib/payments';
import { PLANS, planOf } from '@/lib/plans';
import { priceRows } from '@/lib/pricing';
import { changePlanAction } from '../actions';

const KIND: Record<string, string> = {
  TOP_UP: 'Recharge',
  PROMO: 'Free credit',
  MESSAGE: 'Message',
  SUBSCRIPTION: 'Plan',
  ADJUSTMENT: 'Adjustment',
};

export default async function WalletPage() {
  const user = await requireUser();
  const [wallet, waba] = await Promise.all([
    prisma.wallet.findUniqueOrThrow({
      where: { orgId: user.orgId },
      include: { entries: { orderBy: { createdAt: 'desc' }, take: 50 } },
    }),
    prisma.waba.findFirst({ where: { orgId: user.orgId }, orderBy: { connectedAt: 'desc' }, select: { id: true, billingMode: true } }),
  ]);
  const prices = await priceRows(user.org.plan, waba?.billingMode);
  const walletAccount = ACCOUNT.wallet(wallet.id);
  const { org } = user;
  const current = planOf(org.plan);
  const renewal = org.planRenewsAt?.toLocaleDateString('en-IN', { dateStyle: 'medium' });

  return (
    <>
      <PageHeader title="Wallet" description="Your prepaid balance. You’re only charged for messages that are delivered." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-2">
          <h2 className="text-sm text-slate-500">Available</h2>
          <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums text-slate-900">
            <CountUp value={Number(wallet.balanceMicros - wallet.reservedMicros)} format="rupees" />
          </p>
          {wallet.reservedMicros > 0n && (
            <p className="mt-1 text-sm text-slate-500">{formatRupees(Number(wallet.reservedMicros))} on hold for messages still being delivered</p>
          )}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="label">Add money</p>
            <Recharge enabled={rechargeEnabled()} brand={BRAND} email={user.email} name={user.name} />
          </div>
        </section>

        <section className="card space-y-4 lg:col-span-3">
          <SectionTitle title="Prices" description="Per delivered message to an Indian number." />
          <PriceTable rows={prices} />
          <p className="text-sm text-slate-600">
            {prices.some((r) => r.meta !== null) ? (
              <>
                Meta takes its fee from your account at Meta, so{' '}
                <a href={metaBillingUrl()} target="_blank" rel="noreferrer" className="link">
                  add funds or a card there
                </a>{' '}
                too.{' '}
              </>
            ) : (
              'Everything comes from this wallet, Meta’s fee included. '
            )}
            <Link href="/dashboard/help#pay" className="link">
              How paying works
            </Link>
          </p>
        </section>
      </div>

      {waba && waba.billingMode !== 'CREDIT_LINE' && (
        <Suspense fallback={<div className="mt-10 h-64 animate-pulse rounded-xl bg-slate-100" />}>
          <MetaChargesSection wabaId={waba.id} />
        </Suspense>
      )}

      <section id="plan" className="mt-10 scroll-mt-6">
        <SectionTitle
          title="Plan"
          description={`You’re on ${current.name}${renewal ? (org.planCancelled ? `, until ${renewal}` : `, renews ${renewal}`) : ''}. Plans are paid from your wallet each month.`}
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {PLANS.map((p) => {
            const isCurrent = p.key === current.key;
            const free = Number(p.price) === 0;
            return (
              <div key={p.key} className={`card flex flex-col ${isCurrent ? 'border-slate-900' : ''}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">
                    {p.name}
                    {isCurrent && <span className="badge ml-2 align-middle">Current</span>}
                  </h3>
                  <p className="tabular-nums">
                    <span className="text-2xl font-semibold tracking-tight">₹{p.price}</span>
                    <span className="text-sm text-slate-500">/month</span>
                  </p>
                </div>
                <ul className="my-5 flex-1 space-y-2 text-sm text-slate-600">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent && !org.planCancelled ? (
                  <p className="text-sm text-slate-500">Your current plan</p>
                ) : free && org.planCancelled ? (
                  <p className="text-sm text-slate-500">Starts {renewal}</p>
                ) : (
                  <ActionForm
                    action={changePlanAction}
                    submit={isCurrent ? 'Keep this plan' : free ? `Switch to ${p.name}` : `Upgrade for ₹${p.price}/month`}
                    buttonClass={free ? 'btn-ghost' : 'btn'}
                  >
                    <input type="hidden" name="plan" value={p.key} />
                  </ActionForm>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <SectionTitle title="Transactions" description="Recharges, free credit and what each message cost." />
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="table">
            <thead>
              <tr>
                <th className="pl-5">Date</th>
                <th>Type</th>
                <th>Details</th>
                <th className="pr-5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {wallet.entries.map((entry) => {
                const incoming = entry.credit === walletAccount;
                return (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap pl-5 text-slate-500">{formatTime(entry.createdAt)}</td>
                    <td className="text-slate-900">{KIND[entry.kind] ?? entry.kind}</td>
                    <td className="text-slate-500">{entry.note ?? (entry.messageId ? `Message ${entry.messageId.slice(-8)}` : '')}</td>
                    <td className={`pr-5 text-right font-mono text-[13px] ${incoming ? 'text-brand-700' : 'text-slate-700'}`}>
                      {incoming ? '+' : '−'}
                      {formatRupees(Number(entry.amount))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {wallet.entries.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No transactions yet.</p>}
        </div>
      </section>
    </>
  );
}
