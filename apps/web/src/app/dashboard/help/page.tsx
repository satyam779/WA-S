import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { prisma } from '@wa/db';
import { formatRupees } from '@wa/billing';
import { Accordion } from '@/components/accordion';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { PriceTable } from '@/components/price-table';
import { SectionTabs } from '@/components/section-tabs';
import { PageHeader } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { BRAND, SITE } from '@/lib/env';
import { metaBillingUrl } from '@/lib/meta-billing';
import { PLANS } from '@/lib/plans';
import { priceRows } from '@/lib/pricing';

const CONTENTS = [
  { id: 'connect', label: 'Connect your number' },
  { id: 'existing-number', label: 'Already on WhatsApp' },
  { id: 'other-provider', label: 'Another provider' },
  { id: 'prices', label: 'Prices' },
  { id: 'pay', label: 'How to pay' },
  { id: 'problems', label: 'Problems' },
];

const NUMBERS = [
  { title: 'A new number', text: 'Never used on WhatsApp. Connect it straight away.', href: '#steps', cta: 'See the steps' },
  { title: 'On WhatsApp or WhatsApp Business', text: 'Back up your chats, delete that WhatsApp account, then connect.', href: '#existing-number', cta: 'How to move it' },
  { title: 'With another provider', text: 'Ask them to release it, then connect.', href: '#other-provider', cta: 'How to move it' },
];

const CONNECT_STEPS: React.ReactNode[] = [
  <>
    Open{' '}
    <Link href="/dashboard/connect" className="link">
      Connect WhatsApp
    </Link>
    , choose your type of number and click <b className="font-medium text-slate-900">Open Facebook window</b>.
  </>,
  'Log in with your Facebook account.',
  'Choose your business, or create one with its name, email and country.',
  <>
    Choose <b className="font-medium text-slate-900">Create a new WhatsApp Business account</b>.
  </>,
  'Enter the name customers will see (use your real business name), a category and a short description.',
  <>
    Choose <b className="font-medium text-slate-900">Enter a new phone number</b>, pick the country code and type the number. Then choose Text
    message or Phone call.
  </>,
  'Type the 6-digit code Meta sends to that number.',
  <>
    Click <b className="font-medium text-slate-900">Finish</b>. Back here, your number shows Connected.
  </>,
];

const EXISTING_STEPS: React.ReactNode[] = [
  <>
    <b className="font-medium text-slate-900">Back up your chats (optional).</b> WhatsApp → Settings → Chats → Chat backup → Back up. To keep one chat
    as a file, open it and use Export chat.
  </>,
  <>
    <b className="font-medium text-slate-900">Delete the WhatsApp account.</b> WhatsApp → Settings → Account → Delete account. Enter the number and
    confirm. Uninstalling the app is not enough.
  </>,
  <>
    <b className="font-medium text-slate-900">Wait 5 minutes.</b> Meta needs a few minutes to free the number.
  </>,
  <>
    <b className="font-medium text-slate-900">Connect it here</b> with the steps above, using the same number.
  </>,
];

/** Numbered steps joined by a thin line, appearing one by one as you scroll. */
function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <Stagger as="ol" inView className="space-y-4">
      {steps.map((text, i) => (
        <StaggerItem as="li" key={i} className="relative flex gap-4">
          {i < steps.length - 1 && <span aria-hidden className="absolute -bottom-4 left-3 top-7 w-px bg-slate-200" />}
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white font-mono text-[11px] text-slate-600">
            {i + 1}
          </span>
          <p className="pt-0.5 text-sm leading-relaxed text-slate-600">{text}</p>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function Heading({ title, text }: { title: string; text?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
      {text && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{text}</p>}
    </div>
  );
}

export default async function HelpPage() {
  const user = await requireUser();
  const waba = await prisma.waba.findFirst({ where: { orgId: user.orgId }, orderBy: { connectedAt: 'desc' }, select: { billingMode: true } });
  const prices = await priceRows(user.org.plan, waba?.billingMode);
  // On our credit line, Meta's fee is inside our price and paid from the wallet.
  const direct = prices.some((r) => r.meta !== null);
  const otp = prices[0]!;
  const perThousand = (micros: number) => formatRupees(micros * 1000);

  const problems = [
    {
      question: '“This phone number is already registered to a WhatsApp account”',
      answer: (
        <>
          The number is still on the WhatsApp app. Delete that WhatsApp account, wait 5 minutes and try again.{' '}
          <a href="#existing-number" className="link">
            How
          </a>
        </>
      ),
    },
    { question: 'The Facebook window doesn’t open', answer: 'Allow pop-ups for this site in your browser, then click Open Facebook window again.' },
    {
      question: '“Facebook login was cancelled” or “The signup window was closed before finishing”',
      answer: 'The window was closed early. Start again and click Finish at the end.',
    },
    { question: 'The code doesn’t arrive', answer: 'Check the number and country code. Go back and choose Phone call instead.' },
    { question: 'Ready-made messages say “In review”', answer: 'Meta takes up to 24 hours. Click Refresh at the top of the page to check again.' },
    { question: 'People see your number instead of your name', answer: 'Meta is still checking your display name. This can take a day or two.' },
    ...(direct
      ? [
          {
            question: '“Meta couldn’t charge your WhatsApp account”',
            answer: (
              <>
                Add funds or a card at Meta.{' '}
                <a href="#pay" className="link">
                  How
                </a>
              </>
            ),
          },
        ]
      : []),
    {
      question: '“Wallet balance too low”',
      answer: (
        <>
          <Link href="/dashboard/wallet" className="link">
            Recharge your wallet
          </Link>
          .
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Help" description="How to connect your number, what each message costs and how to pay." />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-14">
        <SectionTabs sections={CONTENTS} />

        <div className="divide-y divide-slate-200 [&>*]:py-12 [&>*:first-child]:pt-0">
          <section id="connect" className="scroll-mt-8">
            <Heading title="Connect your WhatsApp number" text="About 5 minutes. You do it once." />
            <h3 className="text-sm font-medium text-slate-900">You need</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 marker:text-slate-300">
              <li>A Facebook account. You log in with it, and it manages your WhatsApp account.</li>
              <li>A phone number that can get an SMS or a call. It can’t be on the WhatsApp app at the same time.</li>
              <li>Your business name, as customers should see it.</li>
            </ul>

            <h3 className="mt-8 text-sm font-medium text-slate-900">Which number will you use?</h3>
            <div className="mt-3 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-3">
              {NUMBERS.map((n) => (
                <a key={n.title} href={n.href} className="group flex flex-col bg-white p-4 transition-colors hover:bg-slate-50">
                  <span className="text-sm font-medium text-slate-900">{n.title}</span>
                  <span className="mt-1 flex-1 text-sm text-slate-500">{n.text}</span>
                  <span className="mt-3 flex items-center gap-1 text-sm text-slate-900">
                    {n.cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </a>
              ))}
            </div>

            <div id="steps" className="mt-8 scroll-mt-8">
              <h3 className="mb-4 text-sm font-medium text-slate-900">Steps</h3>
              <Steps steps={CONNECT_STEPS} />
            </div>

            <div className="mt-8 rounded-xl bg-slate-50 p-5">
              <h3 className="text-sm font-medium text-slate-900">After you connect, we do this for you</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600 marker:text-slate-300">
                <li>We create your ready-made messages (OTP, order updates, reminders) and send them to Meta. Meta approves them within 24 hours.</li>
                <li>Meta checks your display name. Until then, people may see your number instead of your name.</li>
                <li>New numbers can message a limited number of people a day. Home shows your limit, and Meta raises it as you send messages people want.</li>
              </ul>
              <p className="mt-3 text-sm text-slate-600">
                Your part: {direct ? 'add funds or a card at Meta, and recharge your wallet. ' : 'recharge your wallet. '}
                <a href="#pay" className="link">
                  How to pay
                </a>
              </p>
            </div>
          </section>

          <section id="existing-number" className="scroll-mt-8">
            <Heading
              title="Number already on WhatsApp?"
              text={
                <>
                  A number can be on the WhatsApp app or connected here, not both. Once it’s connected, you reply to customers in{' '}
                  <Link href="/dashboard/chats" className="link">
                    Chats
                  </Link>{' '}
                  instead of the app.
                </>
              }
            />
            <Steps steps={EXISTING_STEPS} />
            <p className="mt-6 border-l-2 border-amber-400 pl-4 text-sm text-slate-600">
              Old chats don’t move here; they stay in your backup. If you skip step 2, Meta shows “This phone number is already registered to a WhatsApp
              account”.
            </p>
          </section>

          <section id="other-provider" className="scroll-mt-8">
            <Heading title="Number with another provider?" text="For example Wati, Interakt or AiSensy." />
            <Steps
              steps={[
                'Ask them to turn off two-step verification for the number, or to remove the number from their account.',
                'When they confirm, connect here with the steps above.',
                'Your old templates and chats stay with them. We create the ready-made messages for you again.',
              ]}
            />
            <p className="mt-6 text-sm text-slate-600">
              Have your own WhatsApp Business API account, without a provider? Choose that option in{' '}
              <Link href="/dashboard/connect" className="link">
                Connect WhatsApp
              </Link>
              .
            </p>
          </section>

          <section id="prices" className="scroll-mt-8">
            <Heading
              title="What each message costs"
              text="Per delivered message to an Indian number. You pay nothing for failed messages, or for any message Meta doesn’t charge for."
            />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
              <PriceTable rows={prices} />
              {otp.ours !== null && (
                <Reveal className="rounded-xl border border-dashed border-slate-300 p-5 text-sm">
                  <p className="font-medium text-slate-900">Example: 1,000 OTPs</p>
                  <dl className="mt-3 space-y-1.5 font-mono text-[13px]">
                    {otp.meta !== null && (
                      <div className="flex justify-between gap-3">
                        <dt className="font-sans text-slate-500">To Meta</dt>
                        <dd>{perThousand(otp.meta)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="font-sans text-slate-500">From your wallet</dt>
                      <dd>{perThousand(otp.ours)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-slate-200 pt-1.5 font-medium text-slate-900">
                      <dt className="font-sans">Total</dt>
                      <dd>{perThousand(otp.ours + (otp.meta ?? 0))}</dd>
                    </div>
                  </dl>
                </Reveal>
              )}
            </div>
            <p className="mt-6 text-sm text-slate-600">
              Monthly plan: {PLANS.map((p) => `${p.name} ₹${p.price}/month`).join(' or ')}, paid from your wallet.{' '}
              <Link href="/dashboard/wallet#plan" className="link">
                Compare plans
              </Link>
            </p>
            <p className="mt-2 text-xs text-slate-500">Meta sets its own prices, adds GST to them and may change them.</p>
          </section>

          <section id="pay" className="scroll-mt-8">
            <Heading
              title="How you pay"
              text={
                direct
                  ? 'There are two separate payments. Set up both before you go live.'
                  : 'Everything comes from your wallet, Meta’s fee included. You don’t need to pay anything at Meta.'
              }
            />
            {direct && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="pl-5" />
                      <th>Meta’s fee</th>
                      <th className="pr-5">Our fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Paid to', 'Meta', BRAND],
                      ['How', 'Funds you add, or a card, on your account at Meta', 'Your wallet here, recharged by UPI, card or net banking'],
                      ['When', 'Meta takes it automatically', 'Taken from the wallet when a message is delivered'],
                      ['Where to see it', 'Wallet → Your account at Meta; balance and invoices at Meta', 'Wallet → Transactions'],
                      ['If it’s missing or empty', 'Meta stops your OTPs, updates and promotions', 'Messages stop until you recharge'],
                    ].map(([label, meta, ours]) => (
                      <tr key={label}>
                        <td className="pl-5 text-slate-500">{label}</td>
                        <td className="text-slate-900">{meta}</td>
                        <td className="pr-5 text-slate-900">{ours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className={`mt-8 grid gap-10 ${direct ? 'md:grid-cols-2' : ''}`}>
              {direct && (
                <div>
                  <h3 className="text-sm font-medium text-slate-900">Pay Meta: add funds or a card</h3>
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600 marker:font-mono marker:text-slate-400">
                    <li>
                      Open Meta’s{' '}
                      <a href={metaBillingUrl()} target="_blank" rel="noreferrer" className="link">
                        Billing &amp; payments
                      </a>{' '}
                      page.
                    </li>
                    <li>Under Accounts, open the WhatsApp Business accounts tab and find your account.</li>
                    <li>Click Add funds to pay in advance, or add a payment method to pay by card.</li>
                  </ol>
                  <p className="mt-3 text-sm text-slate-500">
                    Meta takes its fee from there automatically. Your balance and invoices are on that page; this month’s Meta charges are also on{' '}
                    <Link href="/dashboard/wallet#meta" className="link">
                      Wallet
                    </Link>
                    .
                  </p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-slate-900">Recharge your wallet</h3>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600 marker:font-mono marker:text-slate-400">
                  <li>
                    Open{' '}
                    <Link href="/dashboard/wallet" className="link">
                      Wallet
                    </Link>
                    .
                  </li>
                  <li>Enter an amount (minimum ₹100) and click Recharge.</li>
                  <li>Pay by UPI, card or net banking. You pay exactly the amount you enter.</li>
                </ol>
                <p className="mt-3 text-sm text-slate-500">
                  Each message’s fee is held when it’s sent, taken when it’s delivered and returned if it fails. Unused balance can be refunded within 30
                  days.{' '}
                  <Link href="/refunds" className="link">
                    Refund policy
                  </Link>
                </p>
              </div>
            </div>
          </section>

          <section id="problems" className="scroll-mt-8">
            <Heading title="Common problems" text="Tap a problem to see the fix." />
            <Accordion items={problems} />
            <p className="mt-6 text-sm text-slate-600">
              Still stuck? Email{' '}
              <a href={`mailto:${SITE.supportEmail}`} className="link">
                {SITE.supportEmail}
              </a>{' '}
              with your number and a screenshot.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
