import Link from 'next/link';
import { BRAND, SITE } from '@/lib/env';
import { Logo } from './logo';

const NAV = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#features', label: 'Messages' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#developers', label: 'Developers' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-10 px-5 sm:px-8">
        <Logo brand={BRAND} />
        <nav className="hidden items-center gap-7 text-sm text-slate-600 lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-slate-900">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-5">
          <Link href="/login" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
            Log in
          </Link>
          <Link href="/signup" className="btn">
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 text-sm sm:grid-cols-4 sm:px-8">
        <div className="sm:col-span-2">
          <Logo brand={BRAND} />
          <p className="mt-4 max-w-xs leading-relaxed text-slate-500">OTPs, order updates, reminders and promotions on WhatsApp, for businesses in India.</p>
        </div>
        <div className="space-y-2.5">
          <p className="font-medium text-slate-900">Product</p>
          <Link href="/#pricing" className="block text-slate-500 hover:text-slate-900">
            Pricing
          </Link>
          <Link href="/signup" className="block text-slate-500 hover:text-slate-900">
            Create account
          </Link>
          <a href={`mailto:${SITE.supportEmail}`} className="block text-slate-500 hover:text-slate-900">
            {SITE.supportEmail}
          </a>
        </div>
        <div className="space-y-2.5">
          <p className="font-medium text-slate-900">Legal</p>
          <Link href="/privacy" className="block text-slate-500 hover:text-slate-900">
            Privacy Policy
          </Link>
          <Link href="/terms" className="block text-slate-500 hover:text-slate-900">
            Terms of Service
          </Link>
          <Link href="/refunds" className="block text-slate-500 hover:text-slate-900">
            Refund Policy
          </Link>
        </div>
      </div>
      <p className="mx-auto max-w-6xl border-t border-slate-100 px-5 py-6 text-xs text-slate-400 sm:px-8">
        © {new Date().getFullYear()} {SITE.company}. WhatsApp is a trademark of Meta Platforms, Inc.
      </p>
    </footer>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="prose-page mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <h1 className="font-display text-5xl leading-tight text-slate-900">{title}</h1>
      <p className="mb-10 mt-3 text-sm text-slate-500">Last updated: {updated}</p>
      {children}
    </article>
  );
}
