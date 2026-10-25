import Link from 'next/link';
import { prisma } from '@wa/db';
import { ActionForm } from '@/components/action-form';
import { Badge, Field, PageHeader, formatTime } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { priceLabels } from '@/lib/pricing';
import { createCampaignAction, importContactsAction, resumeCampaignAction } from '../actions';

// Campaign sending continues after the response (after()); the cron picks up anything longer.
export const maxDuration = 60;

export default async function PromotionsPage() {
  const user = await requireUser();
  const [waba, contacts, optedOut, templates, campaigns] = await Promise.all([
    prisma.waba.findFirst({ where: { orgId: user.orgId }, orderBy: { connectedAt: 'desc' } }),
    prisma.contact.count({ where: { orgId: user.orgId } }),
    prisma.contact.count({ where: { orgId: user.orgId, optedOut: true } }),
    prisma.template.findMany({
      where: { waba: { orgId: user.orgId }, status: 'APPROVED', category: 'MARKETING' },
      orderBy: { name: 'asc' },
    }),
    prisma.campaign.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  const prices = await priceLabels(user.org.plan, waba?.billingMode);

  return (
    <div className="space-y-6">
      <PageHeader title="Promotions" description="Send offers to your contacts. Only people who agreed to hear from you, and haven’t replied STOP, receive them." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4">
          <div>
            <h2 className="text-lg font-bold">1. Contacts</h2>
            <p className="text-sm text-slate-500">
              {contacts} contacts, {optedOut} opted out. People who reply STOP are opted out automatically.
            </p>
          </div>
          <ActionForm action={importContactsAction} submit="Import" className="space-y-3">
            <label className="block">
              <span className="label">Paste contacts, one per line: phone, name</span>
              <textarea name="contacts" rows={5} className="input font-mono" placeholder={'+91 98765 43210, Rahul\n9876500000, Priya'} />
            </label>
            <label className="block">
              <span className="label">or upload a CSV file (phone, name)</span>
              <input
                type="file"
                name="file"
                accept=".csv,.txt"
                className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="consent" className="mt-1" />
              These people agreed to receive WhatsApp messages from my business.
            </label>
          </ActionForm>
        </section>

        <section className="card space-y-4">
          <div>
            <h2 className="text-lg font-bold">2. Send a promotion</h2>
            <p className="text-sm text-slate-500">
              {prices.MARKETING}. Goes to all contacts who haven’t opted out.
            </p>
          </div>
          {templates.length === 0 ? (
            <p className="text-sm text-slate-500">
              No approved promotion templates yet.{' '}
              <Link href="/dashboard/templates" className="link">
                Create one on the Templates page
              </Link>
              ; Meta reviews it within 24 hours.
            </p>
          ) : (
            <ActionForm action={createCampaignAction} submit="Send now" className="space-y-3">
              <Field name="name" label="Campaign name" placeholder="Diwali sale" />
              <label className="block">
                <span className="label">Template</span>
                <select name="template" className="input" required>
                  {templates.map((t) => (
                    <option key={t.id} value={`${t.name}|${t.language}`}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </select>
              </label>
              <Field name="variables" label="Values for {{1}}, {{2}}…" placeholder="{name}, DIWALI50" hint="Separate with commas. {name} becomes each contact’s name." />
            </ActionForm>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="mb-4 text-lg font-bold">Campaigns</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Template</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Failed</th>
                <th>Total</th>
                <th>Started</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.templateName}</td>
                  <td>
                    <Badge value={c.status} />
                    {c.error && <p className="mt-1 max-w-xs text-xs text-red-600">{c.error}</p>}
                  </td>
                  <td>{c.sent}</td>
                  <td>{c.failed}</td>
                  <td>{c.total}</td>
                  <td className="whitespace-nowrap">{formatTime(c.createdAt)}</td>
                  <td>
                    {c.status !== 'DONE' && (
                      <ActionForm action={resumeCampaignAction} submit="Continue" buttonClass="btn-ghost py-1">
                        <input type="hidden" name="id" value={c.id} />
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {campaigns.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No campaigns yet.</p>}
        </div>
      </section>
    </div>
  );
}
