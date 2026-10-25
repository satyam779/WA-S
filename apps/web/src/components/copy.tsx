'use client';

import { useState } from 'react';

/** A value the user pastes elsewhere (webhook URL, secret), with a copy button. */
export function Copy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  return (
    <span className="mt-1 flex items-start gap-2">
      <code className="code break-all">{text}</code>
      <button type="button" className="btn-ghost shrink-0 px-2 py-0.5 text-xs" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}
