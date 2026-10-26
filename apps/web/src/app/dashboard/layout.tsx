import type { Metadata } from 'next';
import Link from 'next/link';
import { LogOut, RefreshCw } from 'lucide-react';
import { prisma } from '@wa/db';
import { MotionProvider } from '@/components/motion';
import { Sidebar } from '@/components/sidebar';
import { Badge } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { BRAND, SITE } from '@/lib/env';
import { logoutAction } from '../(auth)/actions';
import { refreshStatus } from './actions';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const phone = await prisma.phoneNumber.findFirst({
    where: { waba: { orgId: user.orgId } },
    orderBy: { waba: { connectedAt: 'desc' } },
  });
  const initials = user.name
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <MotionProvider>
      <div className="min-h-screen bg-white md:flex">
        <Sidebar brand={BRAND} supportEmail={SITE.supportEmail} />
        <div className="min-w-0 flex-1">
          <header className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-2 text-sm md:px-8">
            {phone ? (
              <>
                <span className="font-mono text-[13px] font-medium text-slate-900">{phone.displayPhoneNumber}</span>
                <Badge value={phone.status} />
                <span className="hidden items-center gap-1.5 text-slate-500 sm:flex">
                  Quality <Badge value={phone.qualityRating} />
                </span>
                <form action={refreshStatus}>
                  <button
                    className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    title="Get the latest status from Meta"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
                  </button>
                </form>
              </>
            ) : (
              <Link href="/dashboard/connect" className="flex items-center gap-2 text-slate-500 hover:text-slate-900">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden /> WhatsApp not connected yet
              </Link>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden items-center gap-2.5 sm:flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white" aria-hidden>
                  {initials}
                </span>
                <span className="leading-tight">
                  <span className="block text-[13px] font-medium text-slate-900">{user.name}</span>
                  <span className="block text-xs text-slate-500">{user.org.name}</span>
                </span>
              </span>
              <form action={logoutAction}>
                <button
                  className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  title="Log out"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  <span className="sm:sr-only">Log out</span>
                </button>
              </form>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">{children}</main>
        </div>
      </div>
    </MotionProvider>
  );
}
