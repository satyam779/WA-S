import { prisma } from '@wa/db';
import { ACCOUNT, formatRupees } from '@wa/billing';
import { ActionForm } from '@/components/action-form';
import { Recharge } from '@/components/recharge';
import { PageHeader, formatTime } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { BRAND } from '@/lib/env';
import { rechargeEnabled } from '@/lib/payments';
import { PLANS, planOf } from '@/lib/plans';
import { priceLabels } from '@/lib/pricing';
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
    prisma.waba.findFirst({ where: { orgId: user.orgId }, orderBy: { connectedAt: 'desc' }, select: { billingMode: true } }),
  ]);
  const prices = await priceLabels(user.org.plan, waba?.billingMode);
  const walletAccount = ACCOUNT.wallet(wallet.id);
  const { org } = user;
  const current = planOf(org.plan);
  const renewal = org.planRenewsAt?.toLocaleDateString('en-IN', { dateStyle: 'medium' });

  return (
    <>
      <PageHeader title="Wallet" description="Your prepaid balance. You’re only charged for messages that are delivered." />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4">
          <div>
            <p className="text-sm text-slate-500">Available</p>
            <p className="text-4xl font-bold text-slate-900">{formatRupees(Number(wallet.balanceMicros - wallet.reservedMicros))}</p>
            {wallet.reservedMicros > 0n && (
              <p className="mt-1 text-sm text-slate-500">{formatRupees(Number(wallet.reservedMicros))} on hold for messages still being delivered</p>
            )}
          </div>
          <Recharge enabled={rechargeEnabled()} brand={BRAND} email={user.email} name={user.name} />
        </section>

        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Prices</h2>
          <dl className="space-y-3 text-sm">
            {[
              ['OTP and login codes', prices.AUTHENTICATION],
              ['Order updates and reminders', prices.UTILITY],
              ['Promotions', prices.MARKETING],
            ].map(([label, price]) => (
              <div key={label}>
                <dt className="font-medium text-slate-900">{label}</dt>
                <dd className="text-slate-600">{price}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-slate-500">Prices exclude 18% GST. Failed messages are never charged.</p>
        </section>
      </div>

      <section id="plan" className="card mt-6 scroll-mt-6">
        <h2 className="text-lg font-bold">Plan</h2>
        <p className="mb-4 text-sm text-slate-500">
          You’re on {current.name}
          {renewal && (org.planCancelled ? `, until ${renewal}` : `, renews ${renewal}`)}. Plans are paid from your wallet each month.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {PLANS.map((p) => {
            const isCurrent = p.key === current.key;
            const free = Number(p.price) === 0;
            return (
              <div key={p.key} className={`flex flex-col rounded-xl p-5 ${isCurrent ? 'ring-2 ring-brand-600' : 'ring-1 ring-slate-200'}`}>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p>
                    <span className="text-2xl font-bold">₹{p.price}</span>
                    <span className="text-sm text-slate-500">/month</span>
                  </p>
                </div>
                <ul className="my-4 flex-1 space-y-1 text-sm text-slate-600">
                  {p.features.map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
                {isCurrent && !org.planCancelled ? (
                  <p className="text-sm font-semibold text-brand-700">Your current plan</p>
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

      <section className="card mt-6">
        <h2 className="mb-4 text-lg font-bold">Transactions</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Details</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {wallet.entries.map((entry) => {
                const incoming = entry.credit === walletAccount;
                return (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap">{formatTime(entry.createdAt)}</td>
                    <td>{KIND[entry.kind] ?? entry.kind}</td>
                    <td className="text-slate-500">{entry.note ?? (entry.messageId ? `Message ${entry.messageId.slice(-8)}` : '')}</td>
                    <td className={`text-right font-medium ${incoming ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {incoming ? '+' : '−'}
                      {formatRupees(Number(entry.amount))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {wallet.entries.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No transactions yet.</p>}
        </div>
      </section>
    </>
  );
}
