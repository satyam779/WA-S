import { Logo } from '@/components/logo';
import { BRAND, env } from '@/lib/env';

const POINTS = ['Connect your WhatsApp number in a few minutes', 'Send automatically with one API call', 'Pay only for delivered messages'];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const bonus = Number(env.signupBonusRupees);
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-slate-200 bg-slate-50 p-12 lg:flex">
        <Logo brand={BRAND} />
        <div className="max-w-md">
          <h2 className="font-display text-5xl leading-[1.05] text-slate-900">
            OTPs, order updates and offers on <em className="text-brand-600">WhatsApp</em>.
          </h2>
          <ul className="mt-8 space-y-3 text-slate-600">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3">
                <span className="mt-3 h-px w-4 shrink-0 bg-slate-400" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-slate-500">{bonus > 0 ? `₹${bonus} free credit when you sign up.` : ' '}</p>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo brand={BRAND} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
