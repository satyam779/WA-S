import { headers } from 'next/headers';
import { prisma } from '@wa/db';
import { ActionForm } from '@/components/action-form';
import { Badge, Field, PageHeader, formatTime } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { createApiKeyAction, revokeApiKeyAction } from '../actions';

function Example({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{code}</pre>
    </div>
  );
}

export default async function DevelopersPage() {
  const user = await requireUser();
  const keys = await prisma.apiKey.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: 'desc' } });
  const host = (await headers()).get('host') ?? 'localhost:3000';
  const base = `${host.startsWith('localhost') ? 'http' : 'https'}://${host}/api/v1`;
  const auth = `-H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json"`;

  return (
    <div className="space-y-6">
      <PageHeader title="API keys" description="Connect your website or app: your server makes one API call and we deliver the WhatsApp message. Keep keys secret and use them only on your server." />
      <section className="card">
        <h2 className="mb-4 text-lg font-bold">Your keys</h2>
        <ActionForm action={createApiKeyAction} submit="Create key" className="mb-6 max-w-md space-y-3">
          <Field name="name" label="Key name" placeholder="e.g. Production server" />
        </ActionForm>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Created</th>
                <th>Last used</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="font-medium">{k.name}</td>
                  <td>
                    <span className="code">{k.prefix}…</span>
                  </td>
                  <td>{formatTime(k.createdAt)}</td>
                  <td>{k.lastUsedAt ? formatTime(k.lastUsedAt) : 'Never'}</td>
                  <td>
                    <Badge value={k.revokedAt ? 'REVOKED' : 'ACTIVE'} />
                  </td>
                  <td>
                    {!k.revokedAt && (
                      <ActionForm action={revokeApiKeyAction} submit="Revoke" buttonClass="btn-ghost py-1">
                        <input type="hidden" name="id" value={k.id} />
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card space-y-5">
        <h2 className="text-xl font-bold">API reference</h2>
        <p className="text-sm text-slate-600">
          Base URL <span className="code">{base}</span>. Errors return HTTP 4xx/5xx with{' '}
          <span className="code">{'{"error":{"code":"…","message":"…"}}'}</span>.
        </p>
        <Example
          title="Send an OTP"
          code={`curl -X POST ${base}/otp/send ${auth} \\\n  -d '{"phone":"+919876543210","length":6,"expiry":600}'\n\n→ {"requestId":"…","messageId":"…","expiresAt":"…"}`}
        />
        <Example
          title="Verify an OTP"
          code={`curl -X POST ${base}/otp/verify ${auth} \\\n  -d '{"requestId":"…","code":"482913"}'\n\n→ {"verified":true}  or  {"verified":false,"reason":"invalid_code","attemptsLeft":3}`}
        />
        <Example
          title="Order confirmation (also: order_shipped, order_delivered, payment_reminder, appointment_reminder)"
          code={`curl -X POST ${base}/notify/order_confirmed ${auth} \\\n  -d '{"phone":"+919876543210","name":"Rahul","order_id":"#1234","amount":"₹499","idempotencyKey":"order-1234-confirmed"}'`}
        />
        <Example
          title="Cash-on-delivery check, then read the buyer’s answer"
          code={`curl -X POST ${base}/notify/cod_confirmation ${auth} \
  -d '{"phone":"+919876543210","name":"Rahul","order_id":"1234","amount":"₹1,299"}'

curl ${base}/orders/1234 -H "Authorization: Bearer YOUR_API_KEY"
→ {"order_id":"1234","cod_status":"confirmed"}   (pending | confirmed | cancelled)`}
        />
        <Example
          title="Send any approved template"
          code={`curl -X POST ${base}/messages ${auth} \\\n  -d '{"to":"+919876543210","template":{"name":"order_shipped","language":"en_US","variables":["Rahul","#1234"]},"idempotencyKey":"order-1234-shipped"}'`}
        />
        <Example title="Check message status" code={`curl ${base}/messages/MESSAGE_ID -H "Authorization: Bearer YOUR_API_KEY"`} />
      </section>
    </div>
  );
}
