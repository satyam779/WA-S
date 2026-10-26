import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatRupees } from '@wa/billing';
import { Accordion } from '@/components/accordion';
import {
  CodeTabs,
  MessageJourney,
  MessageShowcase,
  PhoneDemo,
  PriceCalculator,
  type PhoneMessage,
  type Scenario,
  type Showcase,
} from '@/components/landing';
import { Reveal } from '@/components/motion';
import { PriceTable } from '@/components/price-table';
import { BRAND, SITE, env } from '@/lib/env';
import { PLANS } from '@/lib/plans';
import { priceRows, type PriceRow } from '@/lib/pricing';
import { USE_CASES, useCase } from '@/lib/use-cases';

// Prices come from the Rate table; refresh the cached page hourly.
export const revalidate = 3600;

const OTP_TEXT = '482913 is your verification code. For your security, do not share this code.';

/** A ready-made message's text with its example values filled in, as the customer reads it. */
function filled(key: string) {
  const u = useCase(key)!;
  return u.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => u.fields[Number(n) - 1]!.example);
}

const STEPS = [
  { title: 'Create your account', text: 'Sign up with your email. No card needed, and you get free credit to try it.' },
  { title: 'Connect WhatsApp', text: 'Log in with Facebook in a popup and verify your number. We set up your ready-made messages.' },
  { title: 'Start sending', text: 'Call our API from your website or app, connect your Shopify or WooCommerce store, or send from your dashboard.' },
];

export default async function LandingPage() {
  const rows = await priceRows('starter', 'DIRECT_META');
  const priced = rows.filter((r): r is PriceRow & { ours: number; meta: number } => r.ours !== null && r.meta !== null);
  const [otp, utility, marketing] = rows;
  const fee = (r?: PriceRow) => (r?.ours != null ? formatRupees(r.ours) : '—');
  const metaFee = (r?: PriceRow) => (r?.meta != null ? formatRupees(r.meta) : null);
  const total = (r?: PriceRow) => (r?.ours != null && r.meta != null ? `${formatRupees(r.ours + r.meta)} per delivered message` : '');
  const bonus = Number(env.signupBonusRupees);
  const growth = PLANS.find((p) => Number(p.price) > 0);
  const cod = useCase('cod_confirmation');

  // One customer's morning: a login code, then their order is confirmed and shipped, and they reply.
  const phone: PhoneMessage[] = [
    { text: OTP_TEXT, buttons: ['Copy code'], time: '10:02' },
    { text: filled('order_confirmed'), time: '10:05' },
    { text: filled('order_shipped'), time: '10:06' },
    { text: 'Thank you!', time: '10:07', outgoing: true },
  ];

  const scenarios: Scenario[] = [
    {
      id: 'otp',
      label: 'OTP',
      endpoint: '/api/v1/otp/send',
      body: '{ "phone": "+919876543210" }',
      response: '{ "requestId": "cm4x…" }',
      to: '+91 98765 43210',
      kind: 'Authentication',
      bubble: { text: OTP_TEXT, buttons: ['Copy code'] },
      fee: fee(otp),
      metaFee: metaFee(otp),
    },
    {
      id: 'order',
      label: 'Order update',
      endpoint: '/api/v1/notify/order_confirmed',
      body: '{ "phone": "+919876543210",\n  "name": "Rahul", "order_id": "#1234",\n  "amount": "₹499" }',
      response: '{ "status": "accepted" }',
      to: '+91 98765 43210',
      kind: 'Utility',
      bubble: { text: filled('order_confirmed') },
      fee: fee(utility),
      metaFee: metaFee(utility),
    },
    {
      id: 'cod',
      label: 'COD check',
      endpoint: '/api/v1/notify/cod_confirmation',
      body: '{ "phone": "+919876543210",\n  "name": "Rahul", "order_id": "#1234",\n  "amount": "₹1,299" }',
      response: '{ "status": "accepted" }',
      to: '+91 98765 43210',
      kind: 'Utility',
      bubble: { text: filled('cod_confirmation'), buttons: cod?.buttons },
      fee: fee(utility),
      metaFee: metaFee(utility),
    },
  ];

  const showcase: Showcase[] = [
    {
      id: 'otp',
      title: 'OTP and login codes',
      text: 'We create the code, send it and check it for you. Two API calls, nothing to build.',
      bubble: { text: OTP_TEXT, buttons: ['Copy code'] },
      meta: `Authentication · ${total(otp)}`,
    },
    ...['order_confirmed', 'order_shipped', 'cod_confirmation', 'payment_reminder', 'appointment_reminder'].map((key) => {
      const u = USE_CASES.find((x) => x.key === key)!;
      return { id: key, title: u.title, text: u.description, bubble: { text: filled(key), buttons: u.buttons }, meta: `Utility · ${total(utility)}` };
    }),
    {
      id: 'promotion',
      title: 'Promotions',
      text: 'Write your own offer and send it to your contacts. Anyone who replies STOP is removed automatically.',
      bubble: { text: 'Hi Priya, our Diwali sale is live! Get 20% off everything with code DIWALI20 till Sunday.', buttons: ['Shop now'] },
      meta: `Marketing · ${total(marketing)}`,
    },
  ];

  const examples = [
    {
      id: 'notify',
      label: 'Order update',
      code: `curl -X POST ${SITE.url}/api/v1/notify/order_confirmed \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+919876543210",
    "name": "Rahul",
    "order_id": "#1234",
    "amount": "₹499"
  }'

→ { "id": "cm…", "status": "accepted", … }`,
    },
    {
      id: 'otp-send',
      label: 'Send OTP',
      code: `curl -X POST ${SITE.url}/api/v1/otp/send \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "+919876543210"}'

→ { "requestId": "cm…", "messageId": "cm…", "expiresAt": "…" }`,
    },
    {
      id: 'otp-verify',
      label: 'Check OTP',
      code: `curl -X POST ${SITE.url}/api/v1/otp/verify \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"requestId": "cm…", "code": "482913"}'

→ { "verified": true }`,
    },
  ];

  const faq = [
    {
      question: 'Do I need a WhatsApp Business API account already?',
      answer: 'No. When you click Connect WhatsApp, Meta’s own popup creates one for you in a few minutes. If you already have one, you can connect it with its IDs.',
    },
    {
      question: 'Which phone number can I use?',
      answer: 'Any number that can receive an SMS or a call for verification and isn’t on the WhatsApp app at the same time.',
    },
    {
      question: 'My number is already on WhatsApp. Can I still use it?',
      answer:
        'Yes. Back up your chats, delete the WhatsApp account on that number, wait 5 minutes, then connect it here. After that you read and reply to customers from your dashboard instead of the app.',
    },
    {
      question: 'What does Meta charge, and who do I pay?',
      answer:
        'Meta charges a small fee for each delivered message, depending on its type. You pay that to Meta from your account at Meta, with funds you add there or a card. Our fee comes from your prepaid wallet here. Both are in the price table.',
    },
    { question: 'Do failed messages cost anything?', answer: 'No. If a message isn’t delivered, its fee goes back to your wallet.' },
    {
      question: 'Is there a monthly fee or contract?',
      answer: `No contract. The Free plan has no monthly fee: you pay only for delivered messages.${
        growth ? ` The ${growth.name} plan (₹${growth.price}/month) adds Shopify and WooCommerce automation and cash-on-delivery confirmation.` : ''
      }`,
    },
    { question: 'Can customers reply?', answer: 'Yes. Their replies appear in Chats on your dashboard. Your replies within 24 hours of their message are free.' },
    { question: 'Can people stop receiving promotions?', answer: 'Yes. Anyone who replies STOP is removed from your promotion list automatically.' },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[46rem] bg-linear-to-b from-brand-50 via-brand-50/40 to-white" />
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 pb-24 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:pt-20">
          <div>
            <p className="inline-flex animate-fade-up items-center gap-2 text-sm text-brand-800">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
              WhatsApp Business API for businesses in India
            </p>
            <h1 className="mt-5 animate-fade-up font-display text-[2.75rem] leading-[1.03] tracking-[-0.02em] text-slate-900 [animation-delay:60ms] sm:text-6xl xl:text-[4.25rem]">
              Send OTPs, order updates and offers on <em className="text-brand-600">WhatsApp</em>.
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-[17px] leading-relaxed text-slate-600 [animation-delay:120ms]">
              Connect your number in a few minutes. Send from your website with one API call, or from your dashboard. You pay only for messages that
              are delivered.
            </p>
            <div className="mt-9 flex animate-fade-up flex-wrap items-center gap-x-6 gap-y-4 [animation-delay:180ms]">
              <Link href="/signup" className="btn px-5 py-2.5 text-[15px]">
                Start free <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/#pricing" className="group flex items-center gap-1.5 text-[15px] font-medium text-slate-900 hover:text-brand-700">
                See pricing <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
            <p className="mt-5 animate-fade-up text-sm text-slate-500 [animation-delay:240ms]">
              {bonus > 0 ? `₹${bonus} free credit · ` : ''}No monthly fee · No setup cost
            </p>
          </div>
          <div className="animate-fade-up [animation-delay:200ms]">
            <PhoneDemo messages={phone} otpPrice={otp?.ours != null && otp.meta != null ? formatRupees(otp.ours + otp.meta) : '—'} />
          </div>
        </div>
      </section>

      {/* One message, end to end */}
      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal className="max-w-2xl">
            <h2 className="font-display text-4xl leading-[1.05] text-slate-900 sm:text-5xl">
              Watch a message <em className="text-brand-600">travel</em>.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-slate-600">
              From your website to your customer’s WhatsApp. You see every step, and you pay only when it’s delivered.
            </p>
          </Reveal>
          <Reveal className="mt-12">
            <MessageJourney scenarios={scenarios} brand={BRAND} />
          </Reveal>
          <p className="mt-6 text-center text-sm text-slate-500">Works with Shopify and WooCommerce, or any website or app that can make an HTTPS call.</p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-16 border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal>
            <h2 className="max-w-2xl font-display text-4xl leading-[1.05] text-slate-900 sm:text-5xl">
              Set up in <em className="text-brand-600">three steps</em>.
            </h2>
          </Reveal>
          <ol className="mt-14 grid border-t border-slate-200 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-b border-slate-200 py-8 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
                <Reveal>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 font-mono text-sm text-white">{i + 1}</span>
                  <h3 className="mt-6 text-lg font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-slate-600">{s.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you can send */}
      <section id="features" className="scroll-mt-16 border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal className="max-w-2xl">
            <h2 className="font-display text-4xl leading-[1.05] text-slate-900 sm:text-5xl">
              Ready-made messages, <em className="text-brand-600">approved by Meta</em>.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-slate-600">
              We create them in your WhatsApp account when you connect. You only fill in the details, like the customer’s name and order number.
            </p>
          </Reveal>
          <Reveal className="mt-14">
            <MessageShowcase items={showcase} />
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <Reveal>
              <h2 className="font-display text-4xl leading-[1.05] text-slate-900 sm:text-5xl">
                Pay per <em className="text-brand-600">delivered</em> message.
              </h2>
              <p className="mt-5 text-[17px] leading-relaxed text-slate-600">
                Each message has two small fees: Meta’s, which you pay to Meta from your account there (funds you add, or a card), and ours, which comes from your
                prepaid wallet. Failed messages cost nothing.
              </p>
              <dl className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
                {PLANS.map((p) => (
                  <div key={p.key} className="flex items-baseline justify-between gap-4 py-4">
                    <dt>
                      <span className="font-medium text-slate-900">{p.name} plan</span>
                      <span className="mt-0.5 block text-sm text-slate-500">{p.features.slice(0, 2).join(', ')}</span>
                    </dt>
                    <dd className="whitespace-nowrap font-mono text-slate-900">₹{p.price}/mo</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-slate-500">Meta sets its own prices, adds GST to them and may change them.</p>
            </Reveal>
            <Reveal className="space-y-6">
              <PriceTable rows={rows} />
              {priced.length > 0 && <PriceCalculator rows={priced} />}
            </Reveal>
          </div>
        </div>
      </section>

      {/* Developers */}
      <section id="developers" className="scroll-mt-16 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <Reveal>
            <h2 className="font-display text-4xl leading-[1.05] sm:text-5xl">
              One API call <em className="text-brand-300">per message</em>.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-white/60">
              When an order is placed or a user asks for a code, your server makes one call. We pick the right template, send it and track delivery.
            </p>
            <ul className="mt-8 space-y-3 text-[15px] text-white/80">
              {[
                'Clear error messages, in plain English',
                'Idempotency keys, so retries never send twice',
                'Delivery status for every message',
                'Works from any language: it’s one HTTPS call',
              ].map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2.5 h-px w-4 shrink-0 bg-white/30" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal>
            <CodeTabs examples={examples} />
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <Reveal>
            <h2 className="font-display text-4xl leading-[1.05] text-slate-900 sm:text-5xl">Questions</h2>
            <p className="mt-5 text-slate-600">
              Something else? Email{' '}
              <a href={`mailto:${SITE.supportEmail}`} className="link">
                {SITE.supportEmail}
              </a>
              .
            </p>
          </Reveal>
          <Reveal>
            <Accordion items={faq} />
          </Reveal>
        </div>
      </section>

      {/* Call to action */}
      <section className="bg-brand-700 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-end">
          <Reveal>
            <h2 className="font-display text-4xl leading-[1.05] sm:text-6xl">
              Send your first message <em className="text-brand-200">today</em>.
            </h2>
            <p className="mt-4 text-[17px] text-white/75">
              Create an account, connect your number and send a test to your own phone.{bonus > 0 ? ` ₹${bonus} free credit to start.` : ''}
            </p>
          </Reveal>
          <Link href="/signup" className="btn shrink-0 bg-white px-5 py-2.5 text-[15px] text-brand-800 hover:bg-brand-50">
            Create your account <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
