import Link from 'next/link';
import { BRAND, env } from '@/lib/env';

const POINTS = ['Connect your WhatsApp number in about 2 minutes', 'Send automatically with one API call', 'Pay only for delivered messages'];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const bonus = Number(env.signupBonusRupees);
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-brand-800 p-12 text-white lg:flex">
        <Link href="/" className="text-xl font-bold">
          {BRAND}
        </Link>
        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-bold leading-tight">OTPs, order updates and offers on WhatsApp.</h2>
          <ul className="space-y-3 text-white/85">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3">
                <span aria-hidden className="text-emerald-300">
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/60">{bonus > 0 ? `₹${bonus} free credit when you sign up.` : ' '}</p>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 block text-xl font-bold text-brand-700 lg:hidden">
            {BRAND}
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
