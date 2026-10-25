import Link from 'next/link';
import { prisma } from '@wa/db';
import { formatRupees } from '@wa/billing';
import { ActionForm } from '@/components/action-form';
import { EmbeddedSignup } from '@/components/embedded-signup';
import { Badge, Field, PageHeader, Stat } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { connectAction } from './actions';

export default async function HomePage() {
  const user = await requireUser();
  const orgId = user.orgId;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = { orgId, direction: 'OUT' as const, createdAt: { gte: monthStart } };

  const [waba, wallet, sent, delivered, spent, firstMessage, keys, payment] = await Promise.all([
    prisma.waba.findFirst({
      where: { orgId },
      orderBy: { connectedAt: 'desc' },
      include: { phoneNumbers: true, templates: { where: { useCase: { not: null } }, select: { status: true } } },
    }),
    prisma.wallet.findUniqueOrThrow({ where: { orgId } }),
    prisma.message.count({ where: thisMonth }),
    prisma.message.count({ where: { ...thisMonth, status: { in: ['DELIVERED', 'READ'] } } }),
    prisma.message.aggregate({ where: thisMonth, _sum: { chargedMicros: true } }),
    prisma.message.findFirst({ where: { orgId, direction: 'OUT' }, select: { id: true } }),
    prisma.apiKey.count({ where: { orgId, revokedAt: null } }),
    prisma.payment.findFirst({ where: { orgId, status: 'PAID' }, select: { id: true } }),
  ]);
  const phone = waba?.phoneNumbers[0];
  const approved = waba?.templates.filter((t) => t.status === 'APPROVED').length ?? 0;
  const available = Number(wallet.balanceMicros - wallet.reservedMicros);

  const steps = [
    { done: Boolean(phone), title: 'Connect your WhatsApp number', text: 'Log in with Facebook and verify your number. About 2 minutes.', href: '#connect', cta: 'Connect' },
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
    { done: Boolean(payment), title: 'Add money to your wallet', text: `You have ${formatRupees(available)}. Recharge before you go live.`, href: '/dashboard/wallet', cta: 'Recharge' },
  ];
  const remaining = steps.filter((s) => !s.done).length;
  const signup = process.env.META_APP_ID && process.env.META_ES_CONFIG_ID;

  return (
    <>
      <PageHeader title={`Hi ${user.name.split(' ')[0]}`} description="Here’s how your WhatsApp messaging is doing." />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{remaining ? 'Get set up' : 'You’re all set'}</h2>
            <span className="text-sm text-slate-500">
              {steps.length - remaining} of {steps.length} done
            </span>
          </div>
          <ol className="divide-y divide-slate-100">
            {steps.map((s, i) => (
              <li key={s.title} className="flex items-center gap-4 py-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    s.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {s.done ? '✓' : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${s.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{s.title}</p>
                  {!s.done && <p className="text-sm text-slate-500">{s.text}</p>}
                </div>
                {!s.done && (
                  <Link href={s.href} className="btn-ghost shrink-0 py-1">
                    {s.cta}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className="card flex flex-col">
          <h2 className="text-lg font-bold">Wallet</h2>
          <p className="mt-3 text-3xl font-bold text-slate-900">{formatRupees(available)}</p>
          <p className="text-sm text-slate-500">available to spend</p>
          <Link href="/dashboard/wallet" className="btn mt-auto">
            Recharge
          </Link>
        </section>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Sent this month', sent.toLocaleString('en-IN')],
          ['Delivered', delivered.toLocaleString('en-IN')],
          ['Delivery rate', sent ? `${Math.round((delivered / sent) * 100)}%` : '—'],
          ['Spent this month', formatRupees(Number(spent._sum.chargedMicros ?? 0n))],
        ].map(([label, value]) => (
          <div key={label} className="card p-5">
            <dt className="text-sm text-slate-500">{label}</dt>
            <dd className="mt-1 text-2xl font-bold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      {waba && phone ? (
        <section className="card mt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Sending from</p>
              <h2 className="text-xl font-bold">{phone.displayPhoneNumber}</h2>
              <p className="text-sm text-slate-600">{phone.verifiedName ?? waba.name}</p>
            </div>
            <Badge value={phone.status} />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="Quality">
              <Badge value={phone.qualityRating} />
            </Stat>
            <Stat label="Daily limit">{phone.messagingLimitTier?.replace('TIER_', '') ?? 'N/A'}</Stat>
            <Stat label="Ready-made messages">
              {approved} of {waba.templates.length} approved
            </Stat>
            <Stat label="Account ID">
              <span className="code">{waba.metaWabaId}</span>
            </Stat>
          </dl>
          {waba.billingMode === 'DIRECT_META' && (
            <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
              Make sure a payment method is added in{' '}
              <a className="font-semibold underline" href="https://business.facebook.com/wa/manage/home/" target="_blank" rel="noreferrer">
                WhatsApp Manager
              </a>{' '}
              → Payment settings. Meta charges its part of each message there; without it, messages fail.
            </p>
          )}
        </section>
      ) : (
        <section id="connect" className="card mt-6 scroll-mt-6 space-y-4">
          <h2 className="text-lg font-bold">Connect your WhatsApp number</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Click Connect WhatsApp and log in with Facebook.</li>
            <li>Create or choose your business and WhatsApp account.</li>
            <li>Add the number you want to send from and enter the code Meta sends it.</li>
          </ol>
          {signup ? (
            <EmbeddedSignup appId={process.env.META_APP_ID!} configId={process.env.META_ES_CONFIG_ID!} version={env.metaGraphVersion} />
          ) : (
            <p className="text-sm text-red-600">Set META_APP_ID and META_ES_CONFIG_ID to turn on Connect WhatsApp.</p>
          )}
          <details className="rounded-lg bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Already use the WhatsApp Business API? Connect with IDs</summary>
            <div className="mt-4 space-y-4">
              <p className="text-sm text-slate-600">
                In WhatsApp Manager, open your account → <b>Assign partner</b> → enter business ID{' '}
                <span className="code">{process.env.META_BUSINESS_ID ?? 'not configured'}</span> → Full access. Then copy the two IDs below.
              </p>
              <ActionForm action={connectAction} submit="Connect" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="wabaId" label="WhatsApp Business Account ID" hint="Meta also calls it “Messaging account ID”" inputMode="numeric" required />
                  <Field name="phoneNumberId" label="Phone Number ID" inputMode="numeric" required />
                </div>
                <Field name="pin" label="Two-step PIN (only if your number has one)" inputMode="numeric" maxLength={6} />
              </ActionForm>
            </div>
          </details>
        </section>
      )}
    </>
  );
}
