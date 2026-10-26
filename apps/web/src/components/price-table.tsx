import { formatRupees } from '@wa/billing';
import type { PriceRow } from '@/lib/pricing';

const money = (micros: number | null) => (micros === null ? '—' : formatRupees(micros));

/** Per delivered message. Meta's fee gets its own column unless our price already includes it. */
export function PriceTable({ rows }: { rows: PriceRow[] }) {
  const split = rows.some((r) => r.meta !== null);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="table">
        <thead>
          <tr>
            <th className="pl-5">Message</th>
            {split && <th>Meta’s fee</th>}
            <th>{split ? 'Our fee' : 'Price'}</th>
            {split && <th className="pr-5 text-right">Total</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="pl-5 text-slate-900">{r.label}</td>
              {split && <td className="font-mono text-[13px] text-slate-500">{money(r.meta)}</td>}
              <td className="font-mono text-[13px] text-slate-500">{money(r.ours)}</td>
              {split && (
                <td className="pr-5 text-right font-mono text-[13px] font-medium text-slate-900">
                  {r.ours === null ? '—' : money(r.ours + (r.meta ?? 0))}
                </td>
              )}
            </tr>
          ))}
          <tr>
            <td className="pl-5 text-slate-900">Replies within 24 hours of a customer’s message</td>
            <td colSpan={split ? 3 : 1} className="pr-5 text-right font-medium text-brand-700">
              Free
            </td>
          </tr>
        </tbody>
      </table>
      {split && (
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Meta’s fee is paid to Meta. Our fee comes from your wallet.</p>
      )}
    </div>
  );
}
