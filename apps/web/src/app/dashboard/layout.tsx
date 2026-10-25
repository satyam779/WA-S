import type { Metadata } from 'next';
import { prisma } from '@wa/db';
import { Sidebar } from '@/components/sidebar';
import { Badge } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { BRAND } from '@/lib/env';
import { logoutAction } from '../(auth)/actions';
import { refreshStatus } from './actions';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const phone = await prisma.phoneNumber.findFirst({
    where: { waba: { orgId: user.orgId } },
    orderBy: { waba: { connectedAt: 'desc' } },
  });

  return (
    <div className="min-h-screen md:flex">
      <Sidebar brand={BRAND} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-3 text-sm md:px-8">
          {phone ? (
            <>
              <span className="font-semibold text-slate-900">{phone.displayPhoneNumber}</span>
              <Badge value={phone.status} />
              <span className="text-slate-500">
                Quality <Badge value={phone.qualityRating} />
              </span>
              <form action={refreshStatus}>
                <button className="btn-ghost py-1" title="Get the latest status from Meta">
                  ↻ Refresh
                </button>
              </form>
            </>
          ) : (
            <span className="text-slate-500">WhatsApp not connected yet</span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-slate-500 sm:inline">
              {user.name} · {user.org.name}
            </span>
            <form action={logoutAction}>
              <button className="btn-ghost py-1">Log out</button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
