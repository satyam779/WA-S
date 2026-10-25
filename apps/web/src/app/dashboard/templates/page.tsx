import { prisma } from '@wa/db';
import { ActionForm } from '@/components/action-form';
import { Badge, Field, PageHeader } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { createTemplateAction, syncTemplatesAction } from '../actions';

const bodyText = (components: unknown) =>
  (Array.isArray(components) ? components : []).find((c) => c?.type === 'BODY')?.text as string | undefined;

export default async function TemplatesPage() {
  const user = await requireUser();
  const waba = await prisma.waba.findFirst({
    where: { orgId: user.orgId },
    orderBy: { connectedAt: 'desc' },
    include: { templates: { orderBy: [{ name: 'asc' }, { language: 'asc' }] } },
  });
  if (!waba) {
    return (
      <>
        <PageHeader title="Templates" />
        <p className="card text-sm text-slate-500">Connect your WhatsApp number on the Home page first.</p>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Templates" description="Every WhatsApp message uses a template approved by Meta. Your ready-made ones are created for you; add your own for promotions or anything else." />
      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-bold">Create a template</h2>
          <p className="text-sm text-slate-500">
            For promotions or any message we don’t provide ready-made. Meta reviews every template, usually within minutes.
          </p>
        </div>
        <ActionForm action={createTemplateAction} submit="Submit for review" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="name" label="Name" placeholder="diwali_offer" hint="Lowercase letters, numbers and underscores" required />
            <label className="block">
              <span className="label">Type</span>
              <select name="category" className="input">
                <option value="MARKETING">Promotion (marketing)</option>
                <option value="UTILITY">Update about an order or account (utility)</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="label">Message</span>
            <textarea
              name="body"
              rows={4}
              className="input"
              required
              placeholder="Hi {{1}}, our Diwali sale is live! Get 20% off with code {{2}} till Sunday."
            />
            <span className="mt-1 block text-xs text-slate-500">
              Use {'{{1}}'}, {'{{2}}'}… for values that change. Don’t start or end the message with one.
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="examples" label="Example values" placeholder="Rahul, DIWALI20" hint="One per variable, separated by commas" />
            <Field name="footer" label="Footer (optional)" defaultValue="Reply STOP to unsubscribe" maxLength={60} />
            <Field name="buttonText" label="Button text (optional)" placeholder="Shop now" maxLength={25} />
            <Field name="buttonUrl" label="Button link (optional)" placeholder="https://yourstore.com/sale" type="url" />
          </div>
        </ActionForm>
      </section>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-bold">Your templates</h2>
          <ActionForm action={syncTemplatesAction} submit="Refresh from Meta" buttonClass="btn-ghost" />
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {waba.templates.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">
                    {t.name}
                    {t.useCase && <span className="badge ml-2">ready-made</span>}
                  </td>
                  <td>{t.category.toLowerCase()}</td>
                  <td>
                    <Badge value={t.status} />
                  </td>
                  <td className="max-w-md text-slate-600">{bodyText(t.components) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
