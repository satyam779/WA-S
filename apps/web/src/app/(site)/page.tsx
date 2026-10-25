import Link from 'next/link';
import { formatRupees } from '@wa/billing';
import { env } from '@/lib/env';
import { META_PRICE_INR } from '@/lib/use-cases';
import { priceFor } from '@/lib/wallet';

// Prices come from the Rate table; refresh the cached page hourly.
export const revalidate = 3600;

const CHAT = [
  { text: '482913 is your verification code. For your security, do not share this code.', button: 'Copy code', time: '10:02' },
  { text: 'Hi Rahul, thank you for your order! Your order #1234 for ₹499 is confirmed. We will message you when it ships.', time: '10:05' },
  { text: 'Hi Priya, our Diwali sale is live! Get 20% off with code DIWALI20 till Sunday.', button: 'Shop now', time: '18:30' },
];

const FEATURES = [
  { title: 'OTP and login codes', text: 'We create the code, send it and check it. Two API calls, nothing to build.' },
  { title: 'Order updates', text: 'Confirmed, shipped and delivered messages, sent straight from Shopify or WooCommerce. No code.' },
  { title: 'Cash-on-delivery check', text: 'Buyers confirm COD orders with one tap, so you stop shipping fake orders.' },
  { title: 'Abandoned carts', text: 'Remind shoppers who left items in their cart and win back lost sales.' },
  { title: 'Promotions', text: 'Upload your contacts and send offers. People who reply STOP are removed automatically.' },
];

const STEPS = [
  { title: 'Create your account', text: 'Sign up with your email. No card needed.' },
  { title: 'Connect WhatsApp', text: 'Log in with Facebook in a popup and verify your number. We set up your messages automatically.' },
  { title: 'Start sending', text: 'Call our API from your website or app, or send from your dashboard.' },
];

const FAQ = [
  {
    q: 'Do I need a WhatsApp Business API account already?',
    a: 'No. When you click Connect WhatsApp, Meta’s own popup creates one for you in about 2 minutes. If you already have one, you can connect it with its IDs.',
  },
  {
    q: 'Which phone number can I use?',
    a: 'Any number that can receive an SMS or a call for verification. If the number is in use on the WhatsApp or WhatsApp Business app, delete that WhatsApp account first.',
  },
  {
    q: 'What does Meta charge?',
    a: 'Meta charges a small fee for each delivered message, depending on its type. For now Meta bills this fee to the payment method on your WhatsApp account; our fee comes from your wallet. Both are shown in the pricing table.',
  },
  {
    q: 'Is there a monthly fee or contract?',
    a: 'No contract. The Free plan has no monthly fee: you pay only for delivered messages. The Growth plan (₹999/month) adds Shopify and WooCommerce automation, cash-on-delivery confirmation and abandoned cart reminders.',
  },
  { q: 'Can people stop receiving promotions?', a: 'Yes. Anyone who replies STOP is removed from your promotion list automatically.' },
];

async function fee(category: keyof typeof META_PRICE_INR) {
  try {
    return formatRupees((await priceFor('starter', category, 'IN', 'DIRECT_META')).price);
  } catch {
    return '—';
  }
}

export default async function LandingPage() {
  const [otp, utility, marketing] = await Promise.all([fee('AUTHENTICATION'), fee('UTILITY'), fee('MARKETING')]);
  const bonus = Number(env.signupBonusRupees);
  const pricing = [
    { type: 'OTP and login codes', ours: otp, meta: META_PRICE_INR.AUTHENTICATION },
    { type: 'Order updates and reminders', ours: utility, meta: META_PRICE_INR.UTILITY },
    { type: 'Promotions', ours: marketing, meta: META_PRICE_INR.MARKETING },
  ];

  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-800">
              WhatsApp Business API, made simple
            </p>
            <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">Send OTPs, order updates and offers on WhatsApp</h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              Connect your WhatsApp number in about 2 minutes. Send messages automatically from your website with one API call, or from your
              dashboard. Pay only for messages that are delivered.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn px-6 py-3 text-base">
                Start free
              </Link>
              <Link href="/#pricing" className="btn-ghost px-6 py-3 text-base">
                See pricing
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              {bonus > 0 ? `₹${bonus} free credit · ` : ''}No monthly fee · No setup cost
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm rounded-[2rem] bg-slate-900 p-3 shadow-2xl">
            <div className="space-y-3 rounded-[1.5rem] bg-[#e7ded4] p-4">
              <p className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-semibold text-white">Your Store</p>
              {CHAT.map((m) => (
                <div key={m.time} className="max-w-[88%] rounded-lg rounded-tl-none bg-white p-3 text-sm text-slate-800 shadow-sm">
                  <p>{m.text}</p>
                  {m.button && <p className="mt-2 border-t border-slate-100 pt-2 text-center font-medium text-sky-600">{m.button}</p>}
                  <p className="mt-1 text-right text-[10px] text-slate-400">{m.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold text-slate-900">Everything your business needs to send</h2>
        <p className="mt-2 text-slate-600">Ready-made messages, approved by Meta and set up for you.</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold text-slate-900">Live in three steps</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="developers" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">One API call per message</h2>
          <p className="mt-3 text-slate-600">
            When an order is placed or a user asks for a code, your server makes one call. We pick the right template, send it and track
            delivery.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-700">
            <li>✓ Clear error messages, in plain English</li>
            <li>✓ Idempotency keys, so retries never send twice</li>
            <li>✓ Delivery status for every message</li>
          </ul>
        </div>
        <pre className="overflow-x-auto rounded-xl bg-slate-900 p-5 text-xs leading-relaxed text-slate-100">{`curl -X POST https://your-domain/api/v1/notify/order_confirmed \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"phone": "+919876543210",
       "name": "Rahul",
       "order_id": "#1234",
       "amount": "₹499"}'

→ { "id": "cm…", "status": "accepted" }`}</pre>
      </section>

      <section id="pricing" className="scroll-mt-20 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold text-slate-900">Simple, pay-as-you-go pricing</h2>
          <p className="mt-2 text-slate-600">Recharge your wallet and pay per delivered message. Failed messages are free.</p>
          <div className="card mt-8 overflow-x-auto p-0">
            <table className="table">
              <thead>
                <tr>
                  <th className="px-6 py-3">Message</th>
                  <th className="px-6 py-3">Our fee</th>
                  <th className="px-6 py-3">Meta’s fee*</th>
                </tr>
              </thead>
              <tbody>
                {pricing.map((p) => (
                  <tr key={p.type}>
                    <td className="px-6 py-3 font-medium">{p.type}</td>
                    <td className="px-6 py-3">{p.ours}</td>
                    <td className="px-6 py-3">₹{p.meta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            <b>Growth plan, ₹999/month:</b> Shopify and WooCommerce auto-messages, cash-on-delivery confirmation and abandoned cart reminders.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Per delivered message, excluding 18% GST. *Meta bills its fee to the payment method on your WhatsApp account; Meta sets and may
            change its prices.
          </p>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold text-slate-900">Questions</h2>
        <div className="mt-8 divide-y divide-slate-200 rounded-xl ring-1 ring-slate-200">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer list-none font-semibold text-slate-900">
                <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                {f.q}
              </summary>
              <p className="mt-3 pl-5 text-sm text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-brand-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
          <h2 className="text-2xl font-bold text-white">Ready to send your first message?</h2>
          <Link href="/signup" className="btn bg-white px-6 py-3 text-base text-brand-800 hover:bg-brand-50">
            Create free account
          </Link>
        </div>
      </section>
    </>
  );
}
