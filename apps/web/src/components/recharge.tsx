'use client';

import Script from 'next/script';
import { useState, useTransition } from 'react';
import { confirmRechargeAction, createRechargeOrderAction } from '@/app/dashboard/actions';
import type { ActionResult } from './action-form';

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: object) => { open(): void };
  }
}

export function Recharge({ enabled, brand, email, name }: { enabled: boolean; brand: string; email: string; name: string }) {
  const [amount, setAmount] = useState('500');
  const [result, setResult] = useState<ActionResult>();
  const [pending, start] = useTransition();

  if (!enabled) {
    return (
      <button className="btn w-full" disabled title="Add Razorpay keys to .env to enable">
        Recharge
      </button>
    );
  }

  const pay = () =>
    start(async () => {
      setResult(undefined);
      const order = await createRechargeOrderAction(amount);
      if ('error' in order) return setResult(order);
      if (!window.Razorpay) return setResult({ error: 'Payment window is still loading. Try again.' });
      new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: 'INR',
        name: brand,
        description: `Wallet recharge: ${order.label}`,
        prefill: { email, name },
        theme: { color: '#0b5d47' },
        handler: (r: RazorpayResponse) =>
          start(async () =>
            setResult(
              await confirmRechargeAction({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
            ),
          ),
      }).open();
    });

  return (
    <div className="space-y-2">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="flex gap-2">
        <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} aria-label="Amount in rupees" />
        <button className="btn shrink-0" onClick={pay} disabled={pending}>
          {pending ? 'Please wait…' : 'Recharge'}
        </button>
      </div>
      <p className="text-xs text-slate-500">Amount in ₹, minimum ₹100. You pay exactly this amount.</p>
      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
      {result?.ok && <p className="text-sm text-brand-700">{result.ok}</p>}
    </div>
  );
}
