import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight, Check, MessageCircle, TriangleAlert } from 'lucide-react';
import { prisma } from '@wa/db';
import { formatRupees } from '@wa/billing';
import { META_ERROR } from '@wa/meta';
import { ActionForm } from '@/components/action-form';
import { ActivityChart, type Day } from '@/components/activity-chart';
import { MetaThisMonth } from '@/components/meta-charges';
import { CountUp, ProgressBar } from '@/components/motion';
import { Badge, PageHeader } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { indiaMonth } from '@/lib/dates';
import { sendingBlockers } from '@/lib/health';
import { metaBillingUrl } from '@/lib/meta-billing';
import { planOf } from '@/lib/plans';
import { priceFor } from '@/lib/wallet';
import { switchNumberAction } from './actions';

const CONNECT_STEPS = [
  'Click Start setup and tell us which number you’ll use.',
  'Log in with Facebook in the window that opens.',
  'Choose or create your business, then create a WhatsApp Business account.',
  'Enter the name customers will see, then your number and the code Meta sends it.',
];

export default async function HomePage() {
  const user = await requireUser();
  const orgId = user.orgId;
  const { start: monthStart, today, month, hour } = indiaMonth();
  const thisMonth = { orgId, direction: 'OUT' as const, createdAt: { gte: monthStart } };

  const [waba, otherWabas, wallet, sent, delivered, spent, firstMessage, keys, payment, daily] = await Promise.all([
    prisma.waba.findFirst({
      where: { orgId },
      orderBy: { connectedAt: 'desc' },
      include: { phoneNumbers: true, templates: { where: { useCase: { not: null } }, select: { status: true } } },
    }),
    prisma.waba.findMany({
      where: { orgId },
      orderBy: { connectedAt: 'desc' },
      skip: 1,
      include: { phoneNumbers: { take: 1, select: { displayPhoneNumber: true, verifiedName: true } } },
    }),
    prisma.wallet.findUniqueOrThrow({ where: { orgId } }),
    prisma.message.count({ where: thisMonth }),
    prisma.message.count({ where: { ...thisMonth, status: { in: ['DELIVERED', 'READ'] } } }),
    prisma.message.aggregate({ where: thisMonth, _sum: { chargedMicros: true } }),
    prisma.message.findFirst({ where: { orgId, direction: 'OUT' }, select: { id: true } }),
    prisma.apiKey.count({ where: { orgId, revokedAt: null } }),
    prisma.payment.findFirst({ where: { orgId, status: 'PAID' }, select: { id: true } }),
    // createdAt is stored in UTC; count by Indian calendar day.
    prisma.$queryRaw<{ day: number; sent: bigint; delivered: bigint }[]>`
      SELECT EXTRACT(DAY FROM ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::int AS day,
             COUNT(*) AS sent,
             COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'READ')) AS delivered
      FROM "Message"
      WHERE "orgId" = ${orgId} AND direction = 'OUT' AND "createdAt" >= ${monthStart}
      GROUP BY 1`,
  ]);
  const phone = waba?.phoneNumbers[0];
  const approved = waba?.templates.filter((t) => t.status === 'APPROVED').length ?? 0;
  const available = Number(wallet.balanceMicros - wallet.reservedMicros);
  const otpPrice = await priceFor(user.org.plan, 'AUTHENTICATION', 'IN', waba?.billingMode ?? 'DIRECT_META').then(
    (p) => Number(p.price),
    () => 0,
  );
  const otpsLeft = otpPrice > 0 ? Math.floor(Math.max(available, 0) / otpPrice) : null;
  const days: Day[] = Array.from({ length: today }, (_, i) => {
    const row = daily.find((d) => d.day === i + 1);
    return { label: `${i + 1} ${month}`, sent: Number(row?.sent ?? 0), delivered: Number(row?.delivered ?? 0) };
  });

  const steps = [
    { done: Boolean(phone), title: 'Connect your WhatsApp number', text: 'Five short steps with Facebook. About 5 minutes.', href: '/dashboard/connect', cta: 'Start setup' },
    {
      done: approved > 0,
      title: 'Meta approves your messages',
      text: waba
        ? `${approved} of ${waba.templates.length} ready-made messages approved.${approved < waba.templates.length ? ' Meta can take up to 24 hours.' : ''}`
        : 'Starts after you connect.',
      href: '/dashboard/templates',
      cta: 'Check',
    },
    { done: Boolean(firstMessage), title: 'Send yourself a test', text: 'Try an OTP or an order update on your own phone.', href: '/dashboard/use-cases', cta: 'Send a test' },
    { done: keys > 0, title: 'Connect your website or app', text: 'Create an API key and add one API call where the event happens.', href: '/dashboard/developers', cta: 'Get a key' },
    {
      done: Boolean(payment),
      title: 'Add money to your wallet',
      text: `You have ${formatRupees(available)}. Recharge before you go live${waba?.billingMode === 'CREDIT_LINE' ? '' : ', and add funds or a card at Meta for Meta’s fee'}.`,
      href: '/dashboard/help#pay',
      cta: 'How to pay',
    },
  ];
  const done = steps.filter((s) => s.done).length;
  const next = steps.findIndex((s) => !s.done);
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const metrics = [
    { label: 'Sent', value: <CountUp value={sent} /> },
    { label: 'Delivered', value: <CountUp value={delivered} /> },
    { label: 'Delivery rate', value: sent ? <CountUp value={Math.round((delivered / sent) * 100)} format="percent" /> : '—' },
    { label: 'Spent', value: <CountUp value={Number(spent._sum.chargedMicros ?? 0n)} format="rupees" /> },
  ];

  return (
    <>
      <PageHeader title={`${greeting}, ${user.name.split(' ')[0]}`} description={`Your WhatsApp messages in ${month}, at a glance.`}>
        {phone && (
          <Link href="/dashboard/use-cases" className="btn">
            Send a message
          </Link>
        )}
      </PageHeader>

      {!phone && (
        <section id="connect" className="card mb-6 scroll-mt-6 overflow-hidden p-0">
          <div className="grid lg:grid-cols-[1fr_20rem]">
            <div className="p-6 sm:p-8">
              <h2 className="text-lg font-semibold">Connect your WhatsApp number</h2>
              <p className="mt-1 text-sm text-slate-500">You need a Facebook account and a number that can get an SMS or a call. It takes about 5 minutes.</p>
              <ol className="mt-6 space-y-3 text-sm text-slate-700">
                {CONNECT_STEPS.map((text, i) => (
                  <li key={text} className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 font-mono text-[11px] text-slate-500">
                      {i + 1}
                    </span>
                    {text}
                  </li>
                ))}
              </ol>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link href="/dashboard/connect" className="btn px-5 py-2.5">
                  Start setup <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <span className="text-sm text-slate-500">Five short steps. We guide you through Meta’s window.</span>
              </div>
            </div>
            <aside className="border-t border-slate-200 bg-slate-50 p-6 text-sm sm:p-8 lg:border-l lg:border-t-0">
              <p className="font-medium text-slate-900">Is this number on the WhatsApp app?</p>
              <p className="mt-2 leading-relaxed text-slate-600">
                A number can’t be on the app and here at the same time. Back up your chats, delete that WhatsApp account (Settings → Account → Delete
                account) and wait 5 minutes. Then connect it.
              </p>
              <p className="mt-2 leading-relaxed text-slate-600">After that, you reply to customers in Chats instead of the app.</p>
              <Link href="/dashboard/help#existing-number" className="link mt-4 inline-block">
                Step-by-step guide
              </Link>
            </aside>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {next !== -1 && (
            <section className="card p-0">
              <div className="flex items-start justify-between gap-4 px-6 pt-5">
                <div>
                  <h2 className="text-base font-semibold">Finish setting up</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {steps.length - done} {steps.length - done === 1 ? 'step' : 'steps'} left before you go live.
                  </p>
                </div>
                <span className="text-sm tabular-nums text-slate-500">
                  {done} of {steps.length}
                </span>
              </div>
              <div className="px-6 pt-4">
                <ProgressBar value={done / steps.length} label="Setup progress" />
              </div>
              <ol className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {steps.map((s, i) => (
                  <li key={s.title} className="flex items-center gap-4 px-6 py-3.5">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${
                        s.done ? 'bg-brand-600 text-white' : i === next ? 'border-2 border-slate-900 text-slate-900' : 'border border-slate-300 text-slate-400'
                      }`}
                    >
                      {s.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-label="Done" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${s.done ? 'text-slate-400' : i === next ? 'font-medium text-slate-900' : 'text-slate-700'}`}>{s.title}</p>
                      {i === next && <p className="mt-0.5 text-sm text-slate-500">{s.text}</p>}
                    </div>
                    {!s.done &&
                      (i === next ? (
                        <Link href={s.href} className="btn shrink-0 py-1.5">
                          {s.cta}
                        </Link>
                      ) : (
                        <Link href={s.href} className="shrink-0 text-sm text-slate-500 hover:text-slate-900">
                          {s.cta}
                        </Link>
                      ))}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card p-0">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-t-xl border-b border-slate-200 bg-slate-200 sm:grid-cols-4">
              {metrics.map((m) => (
                <div key={m.label} className="bg-white px-6 py-5">
                  <dt className="text-[13px] text-slate-500">{m.label}</dt>
                  <dd className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">{m.value}</dd>
                </div>
              ))}
            </dl>
            <div className="px-6 pb-5 pt-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-slate-900">Messages this month</h2>
                <p className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-slate-200" aria-hidden /> Sent
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-brand-500" aria-hidden /> Delivered
                  </span>
                </p>
              </div>
              <ActivityChart days={days} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card border-brand-100 bg-brand-50/60">
            <div className="flex items-center justify-between">
              <h2 className="text-sm text-brand-800">Wallet balance</h2>
              <Link href="/dashboard/wallet" className="text-sm text-brand-700 hover:text-brand-900">
                History
              </Link>
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-brand-900">
              <CountUp value={available} format="rupees" />
            </p>
            {otpsLeft !== null && (
              <p className="mt-1 text-sm text-slate-500">
                About {otpsLeft.toLocaleString('en-IN')} OTPs at {formatRupees(otpPrice)} each
              </p>
            )}
            {waba && waba.billingMode !== 'CREDIT_LINE' && (
              <Suspense fallback={null}>
                <MetaThisMonth wabaId={waba.id} />
              </Suspense>
            )}
            <Link href="/dashboard/wallet" className="btn mt-5 w-full">
              Recharge
            </Link>
            <div className="mt-5 flex items-center justify-between border-t border-brand-100 pt-4 text-sm">
              <span className="text-slate-500">Plan</span>
              <Link href="/dashboard/wallet#plan" className="flex items-center gap-1 font-medium text-slate-900 hover:underline">
                {planOf(user.org.plan).name} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </section>

          {waba && phone && (
            <section className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm text-slate-500">Sending from</h2>
                  <p className="mt-2 font-mono text-base font-medium text-slate-900">{phone.displayPhoneNumber}</p>
                  <p className="truncate text-sm text-slate-500">{phone.verifiedName ?? waba.name}</p>
                </div>
                <Badge value={phone.status} />
              </div>
              <dl className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
                {[
                  ['Quality', <Badge key="q" value={phone.qualityRating} />],
                  [
                    'Daily limit',
                    phone.messagingLimitTier === 'TIER_UNLIMITED'
                      ? 'Unlimited'
                      : phone.messagingLimitTier
                        ? `${phone.messagingLimitTier.replace('TIER_', '')} people`
                        : '—',
                  ],
                  ['Ready-made messages', `${approved} of ${waba.templates.length} approved`],
                  ['Account ID', <span key="id" className="font-mono text-xs">{waba.metaWabaId}</span>],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-right text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
              <Suspense fallback={null}>
                <SendingBlockers phoneId={phone.id} />
              </Suspense>
              <details className="group mt-5 border-t border-slate-100 pt-4">
                  <summary className="cursor-pointer list-none text-sm text-slate-600 hover:text-slate-900">
                    <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">›</span>
                    Send from a different number
                  </summary>
                  <div className="mt-3 space-y-3">
                    {otherWabas.map((other) => (
                      <div key={other.id} className="rounded-lg border border-slate-200 p-3">
                        <p className="font-mono text-sm text-slate-900">{other.phoneNumbers[0]?.displayPhoneNumber ?? other.name}</p>
                        <p className="mb-2 text-sm text-slate-500">{other.phoneNumbers[0]?.verifiedName ?? other.name}</p>
                        <ActionForm action={switchNumberAction} submit="Use this number" buttonClass="btn-ghost py-1">
                          <input type="hidden" name="wabaId" value={other.id} />
                        </ActionForm>
                      </div>
                    ))}
                    <p className="text-sm text-slate-600">Or add a new one. We set up the ready-made messages there too, and Meta reviews them again.</p>
                    <Link href="/dashboard/connect" className="btn-ghost py-1.5">
                      Add a number <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                </details>
            </section>
          )}

          {!phone && (
            <section className="card text-sm">
              <MessageCircle className="h-5 w-5 text-slate-400" aria-hidden />
              <p className="mt-3 font-medium text-slate-900">New to this?</p>
              <p className="mt-1 text-slate-600">The Help page covers connecting, prices and how to pay, step by step.</p>
              <Link href="/dashboard/help" className="link mt-3 inline-block">
                Open Help
              </Link>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

/** Shown only while Meta blocks this number, with Meta's reasons. Streams in after the rest of the page. */
async function SendingBlockers({ phoneId }: { phoneId: string }) {
  const reasons = await sendingBlockers(phoneId).catch((err) => {
    console.error('Health check failed', err);
    return [];
  });
  if (!reasons.length) return null;
  return (
    <div className="mt-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <div>
        <p className="font-medium">Meta is blocking messages from this number</p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {reasons.map((r, i) => (
            <li key={i}>
              {r.code === META_ERROR.noPaymentMethod ? (
                <>
                  Add funds or a card on{' '}
                  <a className="font-medium underline" href={metaBillingUrl()} target="_blank" rel="noreferrer">
                    Meta’s Billing &amp; payments page
                  </a>
                  . Meta charges its part of each message there.
                </>
              ) : (
                r.text
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
