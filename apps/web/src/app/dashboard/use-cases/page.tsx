import { headers } from 'next/headers';
import { prisma } from '@wa/db';
import { OTP_TEMPLATE_NAME } from '@wa/meta';
import { ActionForm } from '@/components/action-form';
import { Badge, Field, PageHeader } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { priceLabels } from '@/lib/pricing';
import { USE_CASES } from '@/lib/use-cases';
import { sendTestOtpAction, sendUseCaseTestAction, setupTemplatesAction } from '../actions';

function Snippet({ code }: { code: string }) {
  return <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{code}</pre>;
}

/** Shown instead of the test form until Meta lets this message be sent. */
function NotReady({ status }: { status: string }) {
  const text: Record<string, string> = {
    PENDING: 'You can send a test once Meta approves this message, usually within 24 hours.',
    IN_APPEAL: 'Meta is reviewing an appeal for this message. You can send a test once it’s approved.',
    MISSING: 'This message isn’t in your WhatsApp account yet. Click “Set up missing templates” above.',
    'NOT CONNECTED': 'Connect your WhatsApp number on the Home page first.',
  };
  return (
    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
      {text[status] ?? `Meta lists this message as ${status.toLowerCase().replace(/_/g, ' ')}, so it can’t be sent right now.`}
    </p>
  );
}

export default async function UseCasesPage() {
  const user = await requireUser();
  const waba = await prisma.waba.findFirst({
    where: { orgId: user.orgId },
    orderBy: { connectedAt: 'desc' },
    include: { templates: { select: { name: true, status: true } } },
  });
  const prices = await priceLabels(user.org.plan, waba?.billingMode);
  const status = (template: string) => waba?.templates.find((t) => t.name === template)?.status ?? (waba ? 'MISSING' : 'NOT CONNECTED');
  const missing = [OTP_TEMPLATE_NAME, ...USE_CASES.map((u) => u.template)].some((name) => status(name) === 'MISSING');

  const host = (await headers()).get('host') ?? 'localhost:3000';
  const base = `${host.startsWith('localhost') ? 'http' : 'https'}://${host}/api/v1`;
  const auth = '\\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json"';

  return (
    <div className="space-y-6">
      <PageHeader title="OTP & updates" description="Ready-made messages your website or app sends automatically. Test each one on your phone, then copy its API call.">
        {missing && <ActionForm action={setupTemplatesAction} submit="Set up missing templates" />}
      </PageHeader>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">OTP / verification code</h2>
          <Badge value={status(OTP_TEMPLATE_NAME)} />
        </div>
        <p className="text-sm text-slate-500">{prices.AUTHENTICATION}. We generate, send and verify the code for you.</p>
        {status(OTP_TEMPLATE_NAME) === 'APPROVED' ? (
          <ActionForm action={sendTestOtpAction} submit="Send test OTP" className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Field name="phone" label="Your WhatsApp number" placeholder="+91 98765 43210" required />
            </div>
          </ActionForm>
        ) : (
          <NotReady status={status(OTP_TEMPLATE_NAME)} />
        )}
        <Snippet
          code={`curl -X POST ${base}/otp/send ${auth} \\\n  -d '{"phone":"+919876543210"}'\n→ {"requestId":"…"}\n\ncurl -X POST ${base}/otp/verify ${auth} \\\n  -d '{"requestId":"…","code":"482913"}'\n→ {"verified":true}`}
        />
      </section>

      {USE_CASES.map((u) => (
        <section key={u.key} className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{u.title}</h2>
            <Badge value={status(u.template)} />
          </div>
          <p className="text-sm text-slate-500">
            {u.description} {prices.UTILITY}.
          </p>
          <p className="rounded-lg bg-brand-50 p-3 text-sm ring-1 ring-brand-600/20">
            {u.body.replace(/\{\{(\d+)\}\}/g, (_, n) => `[${u.fields[Number(n) - 1]?.label}]`)}
          </p>
          {status(u.template) === 'APPROVED' ? (
            <ActionForm action={sendUseCaseTestAction} submit="Send test" className="space-y-3">
              <input type="hidden" name="useCase" value={u.key} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field name="phone" label="Your WhatsApp number" placeholder="+91 98765 43210" required />
                {u.fields.map((f) => (
                  <Field key={f.name} name={f.name} label={f.label} defaultValue={f.example} required />
                ))}
              </div>
            </ActionForm>
          ) : (
            <NotReady status={status(u.template)} />
          )}
          <Snippet
            code={`curl -X POST ${base}/notify/${u.key} ${auth} \\\n  -d '${JSON.stringify({ phone: '+919876543210', ...Object.fromEntries(u.fields.map((f) => [f.name, f.example])) })}'`}
          />
        </section>
      ))}
    </div>
  );
}
