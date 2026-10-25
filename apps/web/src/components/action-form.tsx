'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

export type ActionResult = { ok?: string; error?: string; secret?: string } | undefined;

interface Props {
  action: (previous: ActionResult, data: FormData) => Promise<ActionResult>;
  submit: string;
  children?: React.ReactNode;
  className?: string;
  buttonClass?: string;
}

/** A form bound to a server action that shows the action's success or error message inline. */
export function ActionForm({ action, submit, children, className, buttonClass = 'btn' }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={submit} className={buttonClass} />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-brand-700">{state.ok}</p>}
      </div>
      {state?.secret && (
        <p className="mt-3 break-all rounded-lg bg-amber-50 p-3 font-mono text-sm ring-1 ring-amber-200">{state.secret}</p>
      )}
    </form>
  );
}

function SubmitButton({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? 'Please wait…' : label}
    </button>
  );
}
