'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useRef, useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CircleX, LoaderCircle, MessageCircle } from 'lucide-react';
import {
  connectWithIdsAction,
  pickNumberAction,
  startSignupAction,
  type ConnectedNumber,
  type SignupResult,
} from '@/app/dashboard/actions';
import { EASE_OUT, ProgressBar } from './motion';

interface FacebookSdk {
  init(options: object): void;
  login(callback: (response: { authResponse?: { code?: string } }) => void, options: object): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
  }
}

const STEPS = ['Let’s start', 'Get ready', 'Connect with Facebook', 'Your number', 'All set'];

type Kind = 'new' | 'app' | 'provider' | 'api';

const KINDS: { kind: Kind; title: string; text: string }[] = [
  { kind: 'new', title: 'A new number', text: 'Not on WhatsApp yet. The quickest way.' },
  { kind: 'app', title: 'A number on the WhatsApp app', text: 'WhatsApp or WhatsApp Business on a phone.' },
  { kind: 'provider', title: 'A number with another provider', text: 'Wati, Interakt, AiSensy or similar.' },
  { kind: 'api', title: 'My own WhatsApp Business API account', text: 'Already set up, without a provider.' },
];

/** Meta's display name rules we can check while the customer types. */
function nameChecks(name: string) {
  const text = name.trim();
  const letters = text.replace(/[^A-Za-z]/g, '');
  return [
    { ok: text.length >= 3, label: 'At least 3 characters' },
    { ok: letters.length <= 4 || text !== text.toUpperCase(), label: 'Not all in capital letters (short acronyms are fine)' },
    { ok: !/\p{Extended_Pictographic}/u.test(text) && !/[~@#$%^*+=<>{}[\]|\\]/.test(text), label: 'No emoji or special symbols' },
    { ok: !/whats\s*app/i.test(text), label: 'Doesn’t use the word “WhatsApp”' },
    { ok: !/(https?:\/\/|www\.|\.(com|in|net|org|co)\b)/i.test(text), label: 'Not a website address' },
  ];
}

/** Meta's name for the screen the customer left on, in plain words. */
const screenName = (step: string) => step.toLowerCase().replace(/_/g, ' ');

/** Opens Meta's signup window and reports what happened. */
function useMetaSignup({ configId, onResult }: { configId: string; onResult: (result: SignupResult) => void }) {
  const session = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  const [status, setStatus] = useState<'idle' | 'open' | 'working'>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    // Meta's window reports progress through postMessage: the IDs on finish, or where the customer stopped.
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (String(data.event).startsWith('FINISH')) {
          session.current = { wabaId: data.data?.waba_id, phoneNumberId: data.data?.phone_number_id };
        } else if (data.event === 'CANCEL' || data.event === 'ERROR') {
          const message = data.data?.error_message;
          const at = data.data?.current_step;
          setProblem(
            message ? `Meta says: ${message}` : `The Facebook window was closed${at ? ` at the ${screenName(at)} screen` : ''}. Open it again to carry on.`,
          );
        }
      } catch {
        // Other SDK messages aren't JSON.
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const launch = () => {
    if (!window.FB) return setProblem('Facebook is still loading. Try again in a moment.');
    session.current = {};
    setProblem(null);
    setStatus('open');
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setStatus('idle');
          setProblem((current) => current ?? 'The Facebook window was closed before you finished. Open it again to carry on.');
          return;
        }
        // The finish message can arrive just after this callback; wait up to 5 seconds for it. The code lasts 30.
        const startedAt = Date.now();
        const finish = () => {
          if (!session.current.wabaId && Date.now() - startedAt < 5_000) return void setTimeout(finish, 200);
          setStatus('working');
          startSignupAction({ code, ...session.current }).then((result) => {
            setStatus('idle');
            onResult(result);
          });
        };
        finish();
      },
      { config_id: configId, response_type: 'code', override_default_response_type: true, extras: { setup: {} } },
    );
  };

  return { launch, status, problem, setProblem };
}

export function ConnectWizard({
  appId,
  configId,
  version,
  signupReady,
  partnerBusinessId,
  billingUrl,
}: {
  appId: string;
  configId: string;
  version: string;
  signupReady: boolean;
  partnerBusinessId: string;
  billingUrl: string;
}) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Kind | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [connected, setConnected] = useState<ConnectedNumber | null>(null);
  const [pick, setPick] = useState<Extract<SignupResult, { pick: unknown }>['pick'] | null>(null);

  const signup = useMetaSignup({
    configId,
    onResult: (result) => {
      if ('error' in result) return signup.setProblem(result.error);
      if ('connected' in result) setConnected(result.connected);
      else setPick(result.pick);
      setStep(3);
    },
  });

  const needsConfirm = kind === 'app' || kind === 'provider';
  const canStart = kind !== null && kind !== 'api' && (!needsConfirm || confirmed);

  return (
    <div className="card overflow-hidden p-0">
      <Script src="https://connect.facebook.net/en_US/sdk.js" crossOrigin="anonymous" onReady={() => window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version })} />
      <div className="grid md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-50 p-4 md:border-b-0 md:border-r md:p-5">
          <div className="md:hidden">
            <p className="text-sm text-slate-500">
              Step {step + 1} of {STEPS.length} · <span className="font-medium text-slate-900">{STEPS[step]}</span>
            </p>
            <div className="mt-2">
              <ProgressBar key={step} value={(step + 1) / STEPS.length} label="Setup progress" />
            </div>
          </div>
          <ol className="hidden space-y-1 md:block">
            {STEPS.map((label, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <li key={label} aria-current={current ? 'step' : undefined} className="relative">
                  {i < STEPS.length - 1 && <span aria-hidden className={`absolute left-[1.45rem] top-9 h-4 w-px ${done ? 'bg-brand-300' : 'bg-slate-200'}`} />}
                  <div className="relative flex items-center gap-3 rounded-lg px-3 py-2.5">
                    {current && (
                      <motion.span
                        layoutId="wizard-step"
                        className="absolute inset-0 rounded-lg border border-brand-100 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    )}
                    <span
                      className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] transition-colors ${
                        done ? 'bg-brand-600 text-white' : current ? 'border-2 border-brand-600 text-brand-700' : 'border border-slate-300 text-slate-400'
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-label="Done" /> : i + 1}
                    </span>
                    <span className={`relative text-sm ${current ? 'font-medium text-slate-900' : done ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="min-h-[30rem] p-6 sm:p-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              {step === 0 && (
                <Step title="Which number will you connect?" text="This decides what you need to do first.">
                  <div role="radiogroup" aria-label="Your number" className="grid gap-3 sm:grid-cols-2">
                    {KINDS.map((k) => (
                      <button
                        key={k.kind}
                        type="button"
                        role="radio"
                        aria-checked={kind === k.kind}
                        onClick={() => {
                          setKind(k.kind);
                          setConfirmed(false);
                        }}
                        className={`cursor-pointer rounded-xl border p-4 text-left transition-colors ${
                          kind === k.kind ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">{k.title}</span>
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                              kind === k.kind ? 'border-brand-600 bg-brand-600' : 'border-slate-300'
                            }`}
                            aria-hidden
                          >
                            {kind === k.kind && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm text-slate-500">{k.text}</span>
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    {kind && (
                      <motion.div
                        key={kind}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                        className="overflow-hidden"
                      >
                        <div className="pt-6">
                          {kind === 'new' && <p className="text-sm text-slate-600">Good choice. Keep the phone with this number nearby: Meta sends it a 6-digit code.</p>}
                          {kind === 'app' && (
                            <Prep
                              steps={[
                                'Back up your chats if you want them: WhatsApp → Settings → Chats → Chat backup.',
                                'Delete the WhatsApp account: WhatsApp → Settings → Account → Delete account. Uninstalling the app is not enough.',
                                'Wait 5 minutes, so Meta frees the number.',
                              ]}
                              note="A number can’t be on the WhatsApp app and here at the same time. After connecting, you reply to customers in Chats."
                              confirm="I’ve deleted the WhatsApp account on this number"
                              confirmed={confirmed}
                              onConfirm={setConfirmed}
                            />
                          )}
                          {kind === 'provider' && (
                            <Prep
                              steps={[
                                'Ask your current provider to turn off two-step verification for the number, or to remove it from their account.',
                                'Wait for them to confirm. Your old templates and chats stay with them.',
                              ]}
                              note="We create the ready-made messages for you again once the number is here."
                              confirm="My old provider has released the number"
                              confirmed={confirmed}
                              onConfirm={setConfirmed}
                            />
                          )}
                          {kind === 'api' && (
                            <IdsForm
                              partnerBusinessId={partnerBusinessId}
                              onConnected={(number) => {
                                setConnected(number);
                                setStep(4);
                              }}
                            />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {kind !== 'api' && (
                    <Nav>
                      <span />
                      <button type="button" className="btn" disabled={!canStart} onClick={() => setStep(1)}>
                        Continue <ArrowRight className="h-4 w-4" aria-hidden />
                      </button>
                    </Nav>
                  )}
                </Step>
              )}

              {step === 1 && (
                <Step title="Get these ready" text="Meta’s window asks for them. It takes about 5 minutes.">
                  <ol className="space-y-4">
                    {[
                      ['Your Facebook login', 'The account that will manage your WhatsApp. Use your own, not a page.'],
                      ['Your business', 'Pick your business on Facebook, or create one with its name, email and country.'],
                      ['The name customers will see', 'Meta checks it against your business name. Try yours below.'],
                      ['The phone with your number', 'Meta sends it a 6-digit code by SMS or a call.'],
                    ].map(([title, text], i) => (
                      <li key={title} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 font-mono text-[11px] text-white">{i + 1}</span>
                        <span className="text-sm">
                          <span className="block font-medium text-slate-900">{title}</span>
                          <span className="text-slate-600">{text}</span>
                        </span>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-8 rounded-xl border border-slate-200 p-5">
                    <label className="block">
                      <span className="label">Check your display name</span>
                      <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Sharma Sweets" maxLength={60} />
                    </label>
                    {displayName.trim() && (
                      <ul className="mt-3 space-y-1.5 text-sm">
                        {nameChecks(displayName).map((c) => (
                          <li key={c.label} className={`flex items-center gap-2 ${c.ok ? 'text-brand-700' : 'text-red-700'}`}>
                            {c.ok ? <Check className="h-4 w-4" aria-hidden /> : <CircleX className="h-4 w-4" aria-hidden />}
                            {c.label}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 text-xs text-slate-500">It should match your business or brand name, for example the name on your shop board or website.</p>
                  </div>

                  <Nav>
                    <BackButton onClick={() => setStep(0)} />
                    <button type="button" className="btn" onClick={() => setStep(2)}>
                      I’m ready <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  </Nav>
                </Step>
              )}

              {step === 2 && (
                <Step title="Connect with Facebook" text="A Facebook window opens. Follow it to the end and click Finish.">
                  <ol className="grid gap-x-8 gap-y-2 text-sm text-slate-600 sm:grid-flow-col sm:grid-rows-3">
                    {[
                      'Log in with Facebook',
                      'Choose or create your business',
                      'Create a WhatsApp Business account',
                      'Enter your display name and category',
                      'Enter your number and the code',
                      'Click Finish',
                    ].map((text, i) => (
                      <li key={text} className="flex gap-2.5">
                        <span className="font-mono text-slate-400">{i + 1}</span>
                        {text}
                      </li>
                    ))}
                  </ol>

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    {signupReady ? (
                      <button type="button" className="btn px-5 py-2.5" onClick={signup.launch} disabled={signup.status !== 'idle'}>
                        {signup.status === 'idle' ? (
                          <>
                            <MessageCircle className="h-4 w-4" aria-hidden /> Open Facebook window
                          </>
                        ) : (
                          <>
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                            {signup.status === 'open' ? 'Waiting for you in the Facebook window…' : 'Connecting your number…'}
                          </>
                        )}
                      </button>
                    ) : (
                      <p className="text-sm text-red-600">Connect WhatsApp isn’t set up yet (META_APP_ID and META_ES_CONFIG_ID are missing).</p>
                    )}
                  </div>
                  {signup.status === 'working' && (
                    <p className="mt-3 text-sm text-slate-500">Registering your number and creating your ready-made messages. This takes a few seconds.</p>
                  )}
                  {signup.problem && (
                    <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      <p>{signup.problem}</p>
                      {/already registered|WhatsApp account/i.test(signup.problem) && (
                        <button
                          type="button"
                          className="mt-2 font-medium underline"
                          onClick={() => {
                            setKind('app');
                            setConfirmed(false);
                            setStep(0);
                          }}
                        >
                          See how to free a number that’s on the WhatsApp app
                        </button>
                      )}
                    </div>
                  )}
                  <p className="mt-5 text-xs text-slate-500">Window didn’t open? Allow pop-ups for this site, then try again.</p>

                  <Nav>
                    <BackButton onClick={() => setStep(1)} />
                    <span />
                  </Nav>
                </Step>
              )}

              {step === 3 && (
                <Step
                  title={connected ? 'Your number is connected' : 'Choose your number'}
                  text={connected ? 'Meta finished setting it up.' : 'Your WhatsApp account has these numbers. Pick the one to send from.'}
                >
                  {connected ? (
                    <NumberCard number={connected} />
                  ) : (
                    pick && (
                      <NumberPicker
                        numbers={pick.numbers}
                        onPick={async (phoneNumberId) => {
                          const result = await pickNumberAction({ sealed: pick.sealed, phoneNumberId });
                          if ('connected' in result) setConnected(result.connected);
                          return 'error' in result ? result.error : null;
                        }}
                      />
                    )
                  )}
                  <Nav>
                    <BackButton onClick={() => setStep(2)} />
                    <button type="button" className="btn" disabled={!connected} onClick={() => setStep(4)}>
                      Continue <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  </Nav>
                </Step>
              )}

              {step === 4 && connected && (
                <div>
                  <motion.svg viewBox="0 0 52 52" className="h-14 w-14" aria-hidden>
                    <motion.circle
                      cx="26"
                      cy="26"
                      r="24"
                      fill="none"
                      stroke="#0f7a5c"
                      strokeWidth="3"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.6, ease: EASE_OUT }}
                    />
                    <motion.path
                      d="M15 27l7 7 15-16"
                      fill="none"
                      stroke="#0f7a5c"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, delay: 0.5, ease: EASE_OUT }}
                    />
                  </motion.svg>
                  <h2 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">You’re all set</h2>
                  <p className="mt-1.5 text-sm text-slate-600">
                    <span className="font-mono text-slate-900">{connected.display}</span> is connected
                    {connected.name ? <> as {connected.name}</> : null}. Meta is reviewing your ready-made messages; this takes up to 24 hours.
                  </p>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {[
                      { href: '/dashboard/use-cases', title: 'Send yourself a test', text: 'Once a message is approved, try it on your phone.' },
                      { href: '/dashboard/wallet', title: 'Recharge your wallet', text: 'Our fee for each delivered message comes from it.' },
                      { href: billingUrl, title: 'Add funds or a card at Meta', text: 'Meta takes its own fee from your account there.', external: true },
                      { href: '/dashboard/developers', title: 'Get an API key', text: 'To send from your website or app.' },
                    ].map((next) => (
                      <a
                        key={next.title}
                        href={next.href}
                        {...(next.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                        className="group rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                      >
                        <span className="flex items-center justify-between gap-2 text-sm font-medium text-slate-900">
                          {next.title}
                          {next.external ? (
                            <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-brand-700" aria-hidden />
                          ) : (
                            <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700" aria-hidden />
                          )}
                        </span>
                        <span className="mt-1 block text-sm text-slate-500">{next.text}</span>
                      </a>
                    ))}
                  </div>
                  <Link href="/dashboard" className="btn mt-8">
                    Go to Home
                  </Link>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Step({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-1.5 text-sm text-slate-500">{text}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

function Nav({ children }: { children: React.ReactNode }) {
  return <div className="mt-10 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">{children}</div>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn-ghost" onClick={onClick}>
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back
    </button>
  );
}

/** What to do before connecting a number that's in use elsewhere, with a box to confirm it's done. */
function Prep({
  steps,
  note,
  confirm,
  confirmed,
  onConfirm,
}: {
  steps: string[];
  note: string;
  confirm: string;
  confirmed: boolean;
  onConfirm: (value: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
      <p className="text-sm font-medium text-slate-900">First, free the number</p>
      <ol className="mt-3 space-y-2 text-sm text-slate-700">
        {steps.map((text, i) => (
          <li key={text} className="flex gap-2.5">
            <span className="font-mono text-amber-700">{i + 1}</span>
            {text}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-slate-600">{note}</p>
      <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-900">
        <input type="checkbox" checked={confirmed} onChange={(e) => onConfirm(e.target.checked)} className="h-4 w-4 accent-brand-600" />
        {confirm}
      </label>
    </div>
  );
}

function NumberCard({ number }: { number: ConnectedNumber }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-brand-100 bg-brand-50/60 p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white">
        <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
      </span>
      <div>
        <p className="font-mono text-base font-medium text-slate-900">{number.display}</p>
        {number.name && <p className="text-sm text-slate-600">{number.name}</p>}
      </div>
    </div>
  );
}

function NumberPicker({ numbers, onPick }: { numbers: (ConnectedNumber & { id: string })[]; onPick: (id: string) => Promise<string | null> }) {
  const [chosen, setChosen] = useState(numbers[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <div role="radiogroup" aria-label="Phone number" className="space-y-2">
        {numbers.map((n) => (
          <label
            key={n.id}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${
              chosen === n.id ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <input type="radio" name="number" value={n.id} checked={chosen === n.id} onChange={() => setChosen(n.id)} className="accent-brand-600" />
            <span>
              <span className="block font-mono text-sm text-slate-900">{n.display}</span>
              {n.name && <span className="text-sm text-slate-500">{n.name}</span>}
            </span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="btn mt-5"
        disabled={!chosen || pending}
        onClick={() => start(async () => setError(await onPick(chosen)))}
      >
        {pending ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> Connecting…
          </>
        ) : (
          'Connect this number'
        )}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** Connecting an existing WhatsApp Business API account that the customer shared with us as a partner. */
function IdsForm({ partnerBusinessId, onConnected }: { partnerBusinessId: string; onConnected: (number: ConnectedNumber) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      action={(data) =>
        start(async () => {
          const result = await connectWithIdsAction({
            wabaId: String(data.get('wabaId') ?? ''),
            phoneNumberId: String(data.get('phoneNumberId') ?? ''),
            pin: String(data.get('pin') ?? ''),
          });
          if ('connected' in result) onConnected(result.connected);
          else if ('error' in result) setError(result.error);
        })
      }
    >
      <p className="text-sm text-slate-600">
        In WhatsApp Manager, open your account → <b className="font-medium text-slate-900">Assign partner</b> → enter business ID{' '}
        <span className="code">{partnerBusinessId || 'not configured'}</span> → Full access. Then copy the two IDs here.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">WhatsApp Business Account ID</span>
          <input className="input" name="wabaId" inputMode="numeric" required />
          <span className="mt-1 block text-xs text-slate-500">Meta also calls it “Messaging account ID”</span>
        </label>
        <label className="block">
          <span className="label">Phone Number ID</span>
          <input className="input" name="phoneNumberId" inputMode="numeric" required />
        </label>
      </div>
      <label className="block max-w-xs">
        <span className="label">Two-step PIN (only if your number has one)</span>
        <input className="input" name="pin" inputMode="numeric" maxLength={6} />
      </label>
      <button className="btn" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> Connecting…
          </>
        ) : (
          'Connect'
        )}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
