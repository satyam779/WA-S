'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { ArrowLeft, Check, CheckCheck, Copy, IndianRupee, Mic, Store } from 'lucide-react';
import { formatRupees } from '@wa/billing';
import { EASE_OUT } from './motion';

export type Bubble = { text: string; buttons?: string[] };

/** False while the tab is in the background, where animations pause but timers keep running. */
function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

/** A WhatsApp message bubble. Incoming ones (from the business) show the time; the customer's own show read ticks. */
function MessageBubble({ bubble, time, outgoing }: { bubble: Bubble; time: string; outgoing?: boolean }) {
  return (
    <div
      className={`w-fit max-w-[88%] overflow-hidden rounded-lg text-[13px] leading-snug text-[#111b21] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)] ${
        outgoing ? 'ml-auto rounded-tr-none bg-[#d9fdd3]' : 'rounded-tl-none bg-white'
      }`}
    >
      <p className="whitespace-pre-line px-2.5 pt-2">{bubble.text}</p>
      <p className="flex items-center justify-end gap-1 px-2 pb-1.5 pt-0.5 text-[10px] text-[#667781]">
        {time}
        {outgoing && <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" aria-label="Read" />}
      </p>
      {bubble.buttons?.map((b) => (
        <p key={b} className="border-t border-slate-100 py-2 text-center text-[13px] font-medium text-[#027eb5]">
          {b}
        </p>
      ))}
    </div>
  );
}

const WALLPAPER = { backgroundImage: 'radial-gradient(rgb(0 0 0 / 0.035) 1px, transparent 1px)', backgroundSize: '12px 12px' };

function DateChip() {
  return (
    <span className="mx-auto rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#667781] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]">
      Today
    </span>
  );
}

/** WhatsApp's chat header and wallpaper, around any bubbles. */
function Chat({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 border-b border-black/5 bg-[#f0f2f5] px-3 py-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white">
          <Store className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block text-[13px] font-medium text-[#111b21]">Your Store</span>
          <span className="block text-[10px] text-[#667781]">Business account</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 bg-chat p-3" style={WALLPAPER}>
        <DateChip />
        {children}
      </div>
    </div>
  );
}

export type PhoneMessage = Bubble & { time: string; outgoing?: boolean };

/** A phone with a WhatsApp chat: the business's messages arrive one by one after typing dots, the customer replies, then it starts over. */
export function PhoneDemo({ messages, otpPrice }: { messages: PhoneMessage[]; otpPrice: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-40px' });
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (reduce) return setShown(messages.length);
    if (!inView || !pageVisible) return;
    const next = messages[shown];
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!next) {
      timers.push(setTimeout(() => setShown(0), 4500));
    } else {
      if (!next.outgoing) timers.push(setTimeout(() => setTyping(true), 400));
      timers.push(
        setTimeout(
          () => {
            setTyping(false);
            setShown((n) => n + 1);
          },
          next.outgoing ? 1100 : 1500,
        ),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [shown, inView, pageVisible, reduce, messages]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[19rem]">
      <div className="rounded-[2.6rem] bg-slate-900 p-2.5 shadow-2xl shadow-brand-900/25 ring-1 ring-black/5">
        <div className="overflow-hidden rounded-[2.1rem] bg-chat">
          <div className="bg-[#0b5d47] text-white">
            <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[10px] font-medium text-white/85">
              <span>10:06</span>
              <span className="h-1 w-10 rounded-full bg-white/25" aria-hidden />
              <span>5G</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-1">
              <ArrowLeft className="h-4 w-4 opacity-80" aria-hidden />
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-700">
                <Store className="h-4 w-4" aria-hidden />
              </span>
              <span className="leading-tight">
                <span className="block text-[13px] font-semibold">Your Store</span>
                <span className="block text-[10px] text-white/70">Business account</span>
              </span>
            </div>
          </div>
          <div className="flex h-[25rem] flex-col justify-end gap-2 overflow-hidden p-3" style={WALLPAPER}>
            <AnimatePresence initial={false}>
              {messages.slice(0, shown).map((m, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.25 } }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className={m.outgoing ? 'flex justify-end' : ''}
                >
                  <MessageBubble bubble={m} time={m.time} outgoing={m.outgoing} />
                </motion.div>
              ))}
              {typing && (
                <motion.div
                  key="typing"
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex w-14 items-center justify-center gap-1 rounded-lg rounded-tl-none bg-white py-3 shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]"
                  aria-hidden
                >
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="h-1.5 w-1.5 rounded-full bg-[#8696a0]"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: dot * 0.15 }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 bg-[#f0f2f5] px-2.5 py-2">
            <span className="flex-1 rounded-full bg-white px-3.5 py-2 text-[12px] text-[#8696a0]">Message</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0b5d47] text-white">
              <Mic className="h-4 w-4" aria-hidden />
            </span>
          </div>
        </div>
      </div>

      {/* Two notes beside the phone on wide screens, placed over the header and the typing bar so they never cover a message. */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -right-24 top-3 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg shadow-slate-900/5 xl:flex"
      >
        <CheckCheck className="h-4 w-4 text-[#53bdeb]" aria-hidden />
        <span className="leading-tight">
          <span className="block text-[13px] font-medium text-slate-900">Delivered and read</span>
          <span className="block text-[11px] text-slate-500">You see every status</span>
        </span>
      </motion.div>
      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-24 bottom-3 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg shadow-slate-900/5 xl:flex"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <IndianRupee className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block text-[13px] font-medium text-slate-900">OTP from {otpPrice}</span>
          <span className="block text-[11px] text-slate-500">Only when delivered</span>
        </span>
      </motion.div>
    </div>
  );
}

function Panel({ n, title, children, className = '' }: { n: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
      <p className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 font-mono text-[10px] text-white">{n}</span>
        {title}
      </p>
      {children}
    </div>
  );
}

/** The line between two panels, with a dot running along it while the message is on its way. */
function Connector({ active }: { active: boolean }) {
  return (
    <div aria-hidden className="relative mx-auto h-6 w-px bg-slate-300 lg:mx-0 lg:h-px lg:w-full lg:self-center">
      {active && (
        <>
          <motion.span
            className="absolute -left-[3px] h-[7px] w-[7px] rounded-full bg-brand-500 lg:hidden"
            initial={{ top: '0%' }}
            animate={{ top: '100%' }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
          <motion.span
            className="absolute -top-[3px] hidden h-[7px] w-[7px] rounded-full bg-brand-500 lg:block"
            initial={{ left: '0%' }}
            animate={{ left: '100%' }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </>
      )}
    </div>
  );
}

export type Scenario = {
  id: string;
  label: string;
  endpoint: string;
  body: string;
  response: string;
  to: string;
  kind: string;
  bubble: Bubble;
  fee: string;
  metaFee: string | null;
};

// When each status shows up, as a step number below.
const LOG = [
  { status: 'Accepted', time: '10:02:01', at: 2, color: 'bg-sky-500' },
  { status: 'Sent', time: '10:02:01', at: 3, color: 'bg-sky-500' },
  { status: 'Delivered', time: '10:02:03', at: 5, color: 'bg-brand-500' },
  { status: 'Read', time: '10:02:09', at: 6, color: 'bg-brand-500' },
];
// Milliseconds spent on each step: request, response, accepted, sent, arrives, delivered, read (then the next example).
const STEP_MS = [800, 650, 550, 650, 450, 1400, 3200];
const LAST = STEP_MS.length - 1;

/** One message travelling from a website, through us, to the customer's WhatsApp; it plays through each example in turn. */
export function MessageJourney({ scenarios, brand }: { scenarios: Scenario[]; brand: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-80px' });
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce || !inView || !pageVisible) return;
    const timer = setTimeout(() => {
      if (step < LAST) return setStep(step + 1);
      setIndex((i) => (i + 1) % scenarios.length);
      setStep(0);
    }, STEP_MS[step]);
    return () => clearTimeout(timer);
  }, [step, reduce, inView, pageVisible, scenarios.length]);

  // Without motion, show each example finished.
  const shown = reduce ? LAST : step;
  const s = scenarios[index]!;

  return (
    <div ref={ref} className="rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2.5 pt-0.5">
        <div role="tablist" aria-label="Example message" className="flex gap-1">
          {scenarios.map((sc, i) => (
            <button
              key={sc.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => {
                setIndex(i);
                setStep(0);
              }}
              className={`relative cursor-pointer rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                i === index ? 'font-medium text-brand-800' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {i === index && (
                <motion.span
                  layoutId="journey-tab"
                  className="absolute inset-0 rounded-md border border-brand-100 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{sc.label}</span>
            </button>
          ))}
        </div>
        <span className="px-2 text-xs text-slate-400">Plays on its own, or pick one</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)_2rem_minmax(0,0.9fr)]">
        <Panel n="1" title="Your website calls our API">
          <div className="flex-1 p-4 font-mono text-[12px] leading-relaxed">
            <p className="break-all">
              <span className="text-brand-600">POST</span> <span className="text-slate-900">{s.endpoint}</span>
            </p>
            <pre className="mt-2 whitespace-pre-wrap break-all text-slate-500">{s.body}</pre>
            <p className={`mt-3 border-t border-dashed border-slate-200 pt-3 transition-opacity duration-300 ${shown >= 1 ? 'opacity-100' : 'opacity-0'}`}>
              <span className="text-brand-600">200</span> <span className="break-all text-slate-500">{s.response}</span>
            </p>
          </div>
        </Panel>
        <Connector key={`a-${index}-${shown === 1}`} active={shown === 1} />
        <Panel n="2" title={`${brand} sends it and keeps track`}>
          <div className="flex-1 p-4 text-[13px]">
            <p className="flex items-center justify-between gap-2">
              <span className="font-mono text-[12px] text-slate-900">{s.to}</span>
              <span className="badge">{s.kind}</span>
            </p>
            <ol className="mt-3 space-y-2">
              {LOG.map((row) => (
                <li key={row.status} className="flex items-center justify-between gap-2">
                  <span className={`flex items-center gap-2 transition-colors duration-300 ${shown >= row.at ? 'text-slate-900' : 'text-slate-300'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${shown >= row.at ? row.color : 'bg-slate-200'}`} />
                    {row.status}
                  </span>
                  <span className={`font-mono text-[11px] transition-colors duration-300 ${shown >= row.at ? 'text-slate-400' : 'text-transparent'}`}>{row.time}</span>
                </li>
              ))}
            </ol>
            <div className={`mt-4 space-y-1 border-t border-dashed border-slate-200 pt-3 text-[12px] transition-opacity duration-500 ${shown >= 5 ? 'opacity-100' : 'opacity-0'}`}>
              <p className="flex justify-between gap-2">
                <span className="text-slate-500">Our fee, from your wallet</span>
                <span className="font-mono text-slate-900">{s.fee}</span>
              </p>
              {s.metaFee && (
                <p className="flex justify-between gap-2">
                  <span className="text-slate-500">Meta’s fee, billed by Meta</span>
                  <span className="font-mono text-slate-900">{s.metaFee}</span>
                </p>
              )}
            </div>
          </div>
        </Panel>
        <Connector key={`b-${index}-${shown === 3}`} active={shown === 3} />
        <Panel n="3" title="Your customer gets it on WhatsApp">
          <Chat className="min-h-60 flex-1">
            <AnimatePresence mode="wait">
              {shown >= 4 && (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                  className="origin-top-left"
                >
                  <MessageBubble bubble={s.bubble} time="10:02" />
                </motion.div>
              )}
            </AnimatePresence>
          </Chat>
        </Panel>
      </div>
    </div>
  );
}

export type Showcase = { id: string; title: string; text: string; bubble: Bubble; meta: string };

/** Message types on the left; the real message, as a customer sees it, on the right. */
export function MessageShowcase({ items }: { items: Showcase[] }) {
  const [active, setActive] = useState(0);
  const item = items[active]!;
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
      <div role="tablist" aria-label="Message types" aria-orientation="vertical" className="border-l border-slate-200">
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            onMouseEnter={() => setActive(i)}
            className="relative block w-full cursor-pointer py-3 pl-5 pr-2 text-left"
          >
            {i === active && (
              <motion.span layoutId="showcase-bar" className="absolute inset-y-0 -left-px w-0.5 bg-brand-600" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
            )}
            <span className={`block text-[15px] font-medium transition-colors ${i === active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
              {it.title}
            </span>
            <AnimatePresence initial={false}>
              {i === active && (
                <motion.span
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                  className="block overflow-hidden"
                >
                  <span className="block pt-1 text-sm leading-relaxed text-slate-500">{it.text}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Chat className="min-h-80">
          <AnimatePresence mode="wait">
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="mt-auto flex flex-col gap-2 pb-2 sm:px-6"
            >
              <MessageBubble bubble={item.bubble} time="10:02" />
            </motion.div>
          </AnimatePresence>
        </Chat>
        <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">{item.meta}</p>
      </div>
    </div>
  );
}

// Colours for the code samples: strings, command words and the response line.
function highlight(code: string) {
  return code.split('\n').map((line, i) => {
    if (line.startsWith('→'))
      return (
        <span key={i} className="block text-white/35">
          {line}
        </span>
      );
    const parts = line.split(/("(?:[^"\\]|\\.)*"|\bcurl\b|\s-[XHd]\b)/g);
    return (
      <span key={i} className="block">
        {parts.map((part, j) =>
          part.startsWith('"') ? (
            <span key={j} className="text-brand-300">
              {part}
            </span>
          ) : /^(curl|\s-[XHd])$/.test(part) ? (
            <span key={j} className="text-sky-300">
              {part}
            </span>
          ) : (
            part
          ),
        )}
        {line === '' ? ' ' : null}
      </span>
    );
  });
}

/** Code samples in tabs, with a copy button. */
export function CodeTabs({ examples }: { examples: { id: string; label: string; code: string }[] }) {
  const [active, setActive] = useState(examples[0]?.id);
  const [copied, setCopied] = useState(false);
  const current = examples.find((e) => e.id === active) ?? examples[0]!;
  const copy = () =>
    navigator.clipboard.writeText(current.code.split('\n→')[0]!.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center border-b border-white/10 px-2">
        <div role="tablist" aria-label="Code examples" className="flex">
          {examples.map((e) => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={e.id === active}
              onClick={() => setActive(e.id)}
              className={`relative cursor-pointer px-3 py-3 text-[13px] transition-colors ${e.id === active ? 'text-white' : 'text-white/45 hover:text-white/80'}`}
            >
              {e.label}
              {e.id === active && (
                <motion.span layoutId="code-tab" className="absolute inset-x-3 -bottom-px h-0.5 bg-brand-400" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-brand-300" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.pre
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="min-h-64 overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-white/80"
        >
          {highlight(current.code)}
        </motion.pre>
      </AnimatePresence>
    </div>
  );
}

// Whole paise with Indian digit grouping, e.g. ₹21,500.00.
const inr = (micros: number) => {
  const paise = Math.round(micros / 10_000);
  return `₹${Math.floor(paise / 100).toLocaleString('en-IN')}.${String(paise % 100).padStart(2, '0')}`;
};

function Money({ micros, className }: { micros: number; className?: string }) {
  const spring = useSpring(micros, { stiffness: 140, damping: 22 });
  useEffect(() => spring.set(micros), [micros, spring]);
  const text = useTransform(spring, (value) => inr(value));
  return <motion.span className={`tabular-nums ${className ?? ''}`}>{text}</motion.span>;
}

const VOLUMES = [100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 1_00_000];

/** Pick a message type and a monthly volume; see Meta's part, ours and the total. */
export function PriceCalculator({ rows }: { rows: { short: string; ours: number; meta: number }[] }) {
  const [type, setType] = useState(0);
  const [step, setStep] = useState(2);
  const row = rows[type]!;
  const count = VOLUMES[step]!;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-900">Estimate your month</p>
      <div role="tablist" aria-label="Message type" className="mt-4 grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {rows.map((r, i) => (
          <button
            key={r.short}
            type="button"
            role="tab"
            aria-selected={i === type}
            onClick={() => setType(i)}
            className={`relative cursor-pointer rounded-md px-2 py-1.5 text-[13px] transition-colors ${
              i === type ? 'font-medium text-brand-800' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {i === type && (
              <motion.span
                layoutId="calc-type"
                className="absolute inset-0 rounded-md border border-brand-100 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{r.short}</span>
          </button>
        ))}
      </div>

      <label className="mt-6 block">
        <span className="flex items-baseline justify-between text-sm">
          <span className="text-slate-600">Delivered messages a month</span>
          <span className="font-mono text-slate-900">{count.toLocaleString('en-IN')}</span>
        </span>
        <input
          type="range"
          min={0}
          max={VOLUMES.length - 1}
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
          aria-valuetext={`${count.toLocaleString('en-IN')} messages`}
          className="mt-3 w-full cursor-pointer accent-brand-600"
        />
      </label>

      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">To Meta ({formatRupees(row.meta)} each)</dt>
          <dd className="font-mono text-slate-900">
            <Money micros={row.meta * count} />
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">From your wallet ({formatRupees(row.ours)} each)</dt>
          <dd className="font-mono text-slate-900">
            <Money micros={row.ours * count} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-3">
          <dt className="font-medium text-slate-900">Total</dt>
          <dd className="text-2xl font-semibold tracking-tight text-brand-700">
            <Money micros={(row.meta + row.ours) * count} />
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-400">Meta adds GST to its own fee.</p>
    </div>
  );
}
