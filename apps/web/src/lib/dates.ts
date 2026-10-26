const IST_OFFSET_MS = 5.5 * 3_600_000;

/** Today in India, and the moment this month started there. */
export function indiaMonth(now = Date.now()) {
  const ist = new Date(now + IST_OFFSET_MS);
  const start = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
  const month = (style: 'short' | 'long') => ist.toLocaleString('en-IN', { month: style, timeZone: 'UTC' });
  return { start, today: ist.getUTCDate(), month: month('short'), monthLong: month('long'), hour: ist.getUTCHours() };
}
