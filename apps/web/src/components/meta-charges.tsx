import Link from 'next/link';
import { ArrowUpRight, TriangleAlert } from 'lucide-react';
import { gstOn } from '@wa/billing';
import { indiaMonth } from '@/lib/dates';
import { formatMetaAmount, metaBillingUrl, metaCharges, type MetaCharges } from '@/lib/meta-billing';
import { Badge, SectionTitle } from './ui';

function load(wabaId: string) {
  return metaCharges(wabaId, indiaMonth().start.toISOString()).catch((err) => {
    console.error('Meta charges failed', err);
    return null;
  });
}

// Meta adds 18% GST to what it charges Indian accounts.
const withGst = (c: MetaCharges) => c.total + (c.currency === 'INR' ? gstOn(c.total) : 0);

/** The Wallet page's view of the customer's account at Meta: what Meta has charged, and the way to pay Meta. */
export async function MetaChargesSection({ wabaId }: { wabaId: string }) {
  const charges = await load(wabaId);
  const { monthLong } = indiaMonth();
  const url = metaBillingUrl(charges?.owner?.id);
  return (
    <section id="meta" className="mt-10 scroll-mt-6">
      <SectionTitle
        title="Your account at Meta"
        description="Meta takes its fee for each message from your account at Meta: from funds you add there, or from a card. The charges below come straight from Meta."
      >
        <a href={url} target="_blank" rel="noreferrer" className="btn">
          Add funds or a card at Meta <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      </SectionTitle>

      {charges ? (
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="card lg:col-span-2">
            <p className="text-sm text-slate-500">Meta’s charges in {monthLong} so far</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{formatMetaAmount(withGst(charges), charges.currency)}</p>
            <p className="mt-1 text-sm text-slate-500">
              {charges.currency === 'INR' ? `${formatMetaAmount(charges.total, charges.currency)} + Meta’s 18% GST, ` : ''}for{' '}
              {charges.volume.toLocaleString('en-IN')} messages
            </p>
            <dl className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
              {charges.owner && (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Billed to</dt>
                  <dd className="text-right text-slate-900">{charges.owner.name}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Balance at Meta</dt>
                <dd>
                  <a href={url} target="_blank" rel="noreferrer" className="link">
                    See it at Meta
                  </a>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Paying Meta</dt>
                <dd>{charges.paymentMissing ? <Badge value="MISSING" /> : <span className="text-brand-700">No problems reported</span>}</dd>
              </div>
            </dl>
            {charges.paymentMissing && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Meta can’t take its fee from this account, so it’s stopping your OTPs, updates and promotions. Add funds or a card at Meta to fix it.
              </p>
            )}
            {charges.problems.map((problem) => (
              <p key={problem} className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                <span>Meta says: {problem}</span>
              </p>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 lg:col-span-3">
            <table className="table">
              <thead>
                <tr>
                  <th className="pl-5">Message</th>
                  <th className="text-right">Messages</th>
                  <th className="pr-5 text-right">Meta’s fee</th>
                </tr>
              </thead>
              <tbody>
                {charges.rows.map((row) => (
                  <tr key={row.label}>
                    <td className="pl-5 text-slate-900">{row.label}</td>
                    <td className="text-right font-mono text-[13px] text-slate-500">{row.volume.toLocaleString('en-IN')}</td>
                    <td className="pr-5 text-right font-mono text-[13px] text-slate-900">
                      {row.cost === 0 ? <span className="font-sans font-medium text-brand-700">Free</span> : formatMetaAmount(row.cost, charges.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {charges.rows.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No charges from Meta yet this month.</p>}
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              {charges.currency === 'INR' ? 'Before Meta’s GST. ' : ''}Meta updates these a few times an hour. Your balance and invoices are on Meta’s Billing &amp;
              payments page.
            </p>
          </div>
        </div>
      ) : (
        <p className="card mt-4 text-sm text-slate-500">
          We couldn’t get Meta’s numbers just now. Try again in a few minutes, or check them on Meta’s Billing &amp; payments page.
        </p>
      )}

      <p className="mt-4 max-w-3xl text-sm text-slate-500">
        <b className="font-medium text-slate-700">Why can’t I see my Meta balance or pay Meta here?</b> Meta doesn’t share your balance with apps like
        ours, and only takes payment on its own Billing &amp; payments page. The button above opens it for your business: add funds there, or add a
        card.
      </p>
    </section>
  );
}

/** A line for the Home wallet card: what Meta has charged this month, or a warning if Meta can't take its fee. */
export async function MetaThisMonth({ wabaId }: { wabaId: string }) {
  const charges = await load(wabaId);
  if (!charges) return null;
  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-500">Meta’s charges this month{charges.currency === 'INR' ? ', with Meta’s GST' : ''}</span>
        <Link href="/dashboard/wallet#meta" className="font-medium tabular-nums text-slate-900 hover:underline">
          {formatMetaAmount(withGst(charges), charges.currency)}
        </Link>
      </div>
      {charges.paymentMissing && (
        <a
          href={metaBillingUrl(charges.owner?.id)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          Meta can’t take its fee. Add funds or a card <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
        </a>
      )}
    </>
  );
}
