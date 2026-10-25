type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string };

export function Field({ label, hint, ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" {...props} />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const GOOD = 'bg-emerald-100 text-emerald-700';
const WAIT = 'bg-amber-100 text-amber-700';
const BAD = 'bg-red-100 text-red-700';
const INFO = 'bg-sky-100 text-sky-700';
const TONES: Record<string, string> = {
  GREEN: GOOD, APPROVED: GOOD, CONNECTED: GOOD, DELIVERED: GOOD, READ: GOOD, RECEIVED: GOOD, DONE: GOOD, ACTIVE: GOOD,
  CONFIRMED: GOOD,
  YELLOW: WAIT, PENDING: WAIT, IN_APPEAL: WAIT, QUEUED: WAIT, PAUSED: WAIT, WAITING: WAIT,
  RED: BAD, REJECTED: BAD, FAILED: BAD, FLAGGED: BAD, RESTRICTED: BAD, DISABLED: BAD, MISSING: BAD, CANCELLED: BAD,
  ACCEPTED: INFO, SENT: INFO, SENDING: INFO,
};

// Plain words for Meta's codes; anything else is shown in sentence case ("NOT_APPLICABLE" → "Not applicable").
const LABELS: Record<string, string> = { PENDING: 'In review', GREEN: 'High', YELLOW: 'Medium', RED: 'Low', UNKNOWN: 'Not rated yet' };

export function Badge({ value }: { value?: string | null }) {
  const key = (value || 'N/A').toUpperCase();
  const text = LABELS[key] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().replace(/_/g, ' ') : 'N/A');
  return <span className={`badge ${TONES[key] ?? ''}`}>{text}</span>;
}

export function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export const formatTime = (date: Date) =>
  date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
