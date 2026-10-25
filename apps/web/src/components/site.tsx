import Link from 'next/link';
import { BRAND, SITE } from '@/lib/env';

const NAV = [
  { href: '/#features', label: 'Features' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#developers', label: 'Developers' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold text-brand-700">
          {BRAND}
        </Link>
        <nav className="hidden gap-6 text-sm font-medium text-slate-600 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-slate-900">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
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
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-4 sm:px-6">
        <div className="sm:col-span-2">
          <p className="text-base font-bold text-brand-700">{BRAND}</p>
          <p className="mt-2 max-w-xs text-slate-500">OTPs, order updates, reminders and promotions on WhatsApp, for businesses in India.</p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-slate-900">Product</p>
          <Link href="/#pricing" className="block text-slate-600 hover:text-slate-900">
            Pricing
          </Link>
          <Link href="/signup" className="block text-slate-600 hover:text-slate-900">
            Create account
          </Link>
          <a href={`mailto:${SITE.supportEmail}`} className="block text-slate-600 hover:text-slate-900">
            {SITE.supportEmail}
          </a>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-slate-900">Legal</p>
          <Link href="/privacy" className="block text-slate-600 hover:text-slate-900">
            Privacy Policy
          </Link>
          <Link href="/terms" className="block text-slate-600 hover:text-slate-900">
            Terms of Service
          </Link>
          <Link href="/refunds" className="block text-slate-600 hover:text-slate-900">
            Refund Policy
          </Link>
        </div>
      </div>
      <p className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {SITE.company}. WhatsApp is a trademark of Meta Platforms, Inc.
      </p>
    </footer>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="prose-page mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
      <p className="mb-8 mt-2 text-sm text-slate-500">Last updated: {updated}</p>
      {children}
    </article>
  );
}
