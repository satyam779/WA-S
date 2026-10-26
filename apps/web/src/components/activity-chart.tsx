'use client';

import { motion } from 'motion/react';
import { EASE_OUT } from './motion';

export type Day = { label: string; sent: number; delivered: number };

/** Messages sent per day this month, with the delivered part in green. Hover a day for its numbers. */
export function ActivityChart({ days }: { days: Day[] }) {
  const max = Math.max(...days.map((d) => d.sent), 0);
  const sent = days.reduce((sum, d) => sum + d.sent, 0);
  const delivered = days.reduce((sum, d) => sum + d.delivered, 0);

  return (
    <figure>
      <div
        className="relative h-40"
        role="img"
        aria-label={`Messages this month: ${sent.toLocaleString('en-IN')} sent, ${delivered.toLocaleString('en-IN')} delivered`}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 border-t border-dashed border-slate-200" />
        <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200" />
        {max > 0 && <span className="absolute -top-2.5 right-0 bg-white pl-2 text-[11px] tabular-nums text-slate-400">{max.toLocaleString('en-IN')}</span>}
        <div className="absolute inset-0 flex items-end gap-[3px] border-b border-slate-200">
          {days.map((d, i) => (
            <div key={d.label} className="group relative flex h-full flex-1 items-end justify-center">
              {max > 0 && d.sent > 0 ? (
                <motion.div
                  className="relative w-full max-w-5 origin-bottom overflow-hidden rounded-t-[3px] bg-slate-200"
                  style={{ height: `${(d.sent / max) * 100}%` }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 + i * 0.015 }}
                >
                  <div className="absolute inset-x-0 bottom-0 bg-brand-500" style={{ height: `${(d.delivered / d.sent) * 100}%` }} />
                </motion.div>
              ) : (
                <div className="h-0.5 w-full max-w-5 rounded-full bg-slate-100" />
              )}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <span className="font-medium">{d.label}</span> · {d.sent} sent · {d.delivered} delivered
              </div>
            </div>
          ))}
        </div>
        {max === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">No messages yet this month. Send a test to see it here.</p>
        )}
      </div>
      <figcaption className="mt-2 flex justify-between text-[11px] text-slate-400">
        <span>{days[0]?.label}</span>
        <span>{days.at(-1)?.label}</span>
      </figcaption>
    </figure>
  );
}
