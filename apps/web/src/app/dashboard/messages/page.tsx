import Link from 'next/link';
import { prisma } from '@wa/db';
import { formatRupees } from '@wa/billing';
import { ActionForm } from '@/components/action-form';
import { Badge, Field, PageHeader, formatTime } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { sendTestMessageAction } from '../actions';

export default async function MessagesPage() {
  const user = await requireUser();
  const [templates, messages] = await Promise.all([
    prisma.template.findMany({
      where: { waba: { orgId: user.orgId }, status: 'APPROVED', category: { not: 'AUTHENTICATION' } },
      orderBy: { name: 'asc' },
    }),
    prisma.message.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);

  return (
    <>
      <PageHeader title="Message log" description="Every message sent or received in the last 100, newest first. Status updates arrive from Meta within seconds." />

      <section className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Direction</th>
              <th>Number</th>
              <th>Message</th>
              <th>Status</th>
              <th>Charge</th>
              <th>Problem</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{formatTime(m.createdAt)}</td>
                <td>{m.direction === 'OUT' ? 'Sent' : 'Received'}</td>
                <td>
                  <Link href={`/dashboard/chats?with=${m.contact}`} className="hover:underline" title="Open the chat with this number">
                    +{m.contact}
                  </Link>
                </td>
                <td className="max-w-xs truncate">{m.templateName ?? m.body ?? m.type}</td>
                <td>
                  <Badge value={m.status} />
                </td>
                <td>{m.chargedMicros === null ? '—' : formatRupees(Number(m.chargedMicros))}</td>
                <td className="max-w-xs text-xs text-red-600">{m.errorMessage}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {messages.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No messages yet. Send a test from OTP &amp; updates.</p>}
      </section>

      {templates.length > 0 && (
        <details className="card mt-6">
          <summary className="cursor-pointer font-semibold">Send one message with any approved template</summary>
          <ActionForm action={sendTestMessageAction} submit="Send" className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field name="phone" label="WhatsApp number" placeholder="+91 98765 43210" required />
              <label className="block">
                <span className="label">Template</span>
                <select name="template" className="input" required>
                  {templates.map((t) => (
                    <option key={t.id} value={`${t.name}|${t.language}`}>
                      {t.name} ({t.category.toLowerCase()})
                    </option>
                  ))}
                </select>
              </label>
              <Field name="variables" label="Values" placeholder="Rahul, #1234" hint="For {{1}}, {{2}}… separated by commas" />
            </div>
          </ActionForm>
        </details>
      )}
    </>
  );
}
