'use client';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card max-w-lg">
      <h2 className="text-lg font-bold">Something went wrong</h2>
      <p className="mt-2 text-sm text-slate-600">
        Please try again. If it keeps happening, contact support{error.digest ? ` and mention code ${error.digest}` : ''}.
      </p>
      <button className="btn mt-4" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
