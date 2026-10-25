'use client';

import Script from 'next/script';
import { useEffect, useRef, useState, useTransition } from 'react';
import { completeSignupAction } from '@/app/dashboard/actions';
import type { ActionResult } from './action-form';

interface FacebookSdk {
  init(options: object): void;
  login(callback: (response: { authResponse?: { code?: string } }) => void, options: object): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
  }
}

/** Meta's Embedded Signup popup: the customer creates or picks a WhatsApp account and verifies their number. */
export function EmbeddedSignup({ appId, configId, version }: { appId: string; configId: string; version: string }) {
  const session = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  const [result, setResult] = useState<ActionResult>();
  const [pending, start] = useTransition();

  useEffect(() => {
    // The popup reports the IDs it created through postMessage.
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (String(data.event).startsWith('FINISH')) {
          session.current = { wabaId: data.data?.waba_id, phoneNumberId: data.data?.phone_number_id };
        } else if (data.event === 'CANCEL') {
          setResult({ error: 'The signup window was closed before finishing.' });
        }
      } catch {
        // Other SDK messages aren't JSON.
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const launch = () => {
    if (!window.FB) return setResult({ error: 'Facebook is still loading. Try again in a moment.' });
    setResult(undefined);
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) return setResult({ error: 'Facebook login was cancelled.' });
        // The FINISH message can arrive just after this callback. Wait up to 5s for it; the code stays valid for ~30s.
        const startedAt = Date.now();
        const finish = () => {
          if (!session.current.phoneNumberId && Date.now() - startedAt < 5_000) return void setTimeout(finish, 200);
          start(async () => setResult(await completeSignupAction({ code, ...session.current })));
        };
        finish();
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: '3' },
      },
    );
  };

  return (
    <div className="space-y-3">
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        crossOrigin="anonymous"
        onReady={() => window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version })}
      />
      <button type="button" className="btn px-6 py-3 text-base" onClick={launch} disabled={pending}>
        {pending ? 'Connecting…' : 'Connect WhatsApp'}
      </button>
      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
      {result?.ok && <p className="text-sm text-brand-700">{result.ok}</p>}
    </div>
  );
}
