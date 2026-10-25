import { headers } from 'next/headers';
import Link from 'next/link';
import { prisma, type StoreConnection } from '@wa/db';
import { ActionForm } from '@/components/action-form';
import { Copy } from '@/components/copy';
import { Badge, Field, PageHeader, formatTime } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { planOf } from '@/lib/plans';
import { connectStoreAction, disconnectStoreAction, saveStoreAction } from '../actions';

const STORES = {
  shopify: {
    title: 'Shopify',
    blurb: 'Order confirmation, cash-on-delivery check, shipped and delivered updates, and abandoned cart reminders.',
    events: 'Order creation, Order fulfillment, Fulfillment update, Checkout creation and Checkout update',
  },
  woocommerce: {
    title: 'WooCommerce',
    blurb: 'Order confirmation, cash-on-delivery check and shipped updates.',
    events: 'Order created and Order updated',
  },
} as const;

const TOGGLES = [
  { name: 'sendConfirmed', label: 'Order confirmation (paid orders)' },
  { name: 'codConfirm', label: 'Ask cash-on-delivery buyers to confirm' },
  { name: 'sendShipped', label: 'Order shipped' },
  { name: 'sendDelivered', label: 'Order delivered', only: 'shopify' },
  { name: 'cartReminder', label: 'Abandoned cart reminder (1 hour, shoppers who accepted marketing)', only: 'shopify' },
] as const;

function StoreCard({ platform, store, base }: { platform: keyof typeof STORES; store?: StoreConnection; base: string }) {
  const info = STORES[platform];
  if (!store) {
    return (
      <section className="card space-y-4">
        <h2 className="text-lg font-bold">{info.title}</h2>
        <p className="text-sm text-slate-600">{info.blurb}</p>
        <ActionForm action={connectStoreAction} submit={`Connect ${info.title}`}>
          <input type="hidden" name="platform" value={platform} />
        </ActionForm>
      </section>
    );
  }

  const url = `${base}/api/integrations/${platform}/${store.token}`;
  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{info.title}</h2>
        <Badge value={store.lastEventAt ? 'CONNECTED' : 'PENDING'} />
      </div>
      <p className="text-sm text-slate-500">
        {store.lastEventAt ? `Last order event ${formatTime(store.lastEventAt)}.` : 'Waiting for the first event from your store.'}
      </p>

      <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-700">
        {platform === 'shopify' ? (
          <>
            <li>
              In Shopify admin, open <b>Settings → Notifications → Webhooks</b> and click <b>Create webhook</b>.
            </li>
            <li>
              Choose the event, format <b>JSON</b>, the latest API version, and this URL:
              <Copy text={url} />
            </li>
            <li>Create one webhook for each event: {info.events}.</li>
            <li>Copy the key under “Your webhooks will be signed with” and paste it below.</li>
          </>
        ) : (
          <>
            <li>
              In WordPress, open <b>WooCommerce → Settings → Advanced → Webhooks</b> and click <b>Add webhook</b>.
            </li>
            <li>
              Set status <b>Active</b>, API version <b>v3</b>, this delivery URL:
              <Copy text={url} />
              and this secret:
              <Copy text={decrypt(store.secret!)} />
            </li>
            <li>Save one webhook for each topic: {info.events}.</li>
          </>
        )}
      </ol>

      <ActionForm action={saveStoreAction} submit="Save" className="space-y-3 border-t border-slate-100 pt-4">
        <input type="hidden" name="id" value={store.id} />
        <p className="text-sm font-semibold text-slate-900">Messages to send</p>
        {TOGGLES.filter((t) => !('only' in t) || t.only === platform).map((t) => (
          <label key={t.name} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={t.name} defaultChecked={store[t.name]} />
            {t.label}
          </label>
        ))}
        {platform === 'shopify' && (
          <Field
            name="signingSecret"
            label="Shopify signing key"
            placeholder={store.secret ? 'Saved. Paste a new one to replace it.' : 'Paste the key from step 4'}
            hint="Lets us reject fake order events."
          />
        )}
      </ActionForm>

      <ActionForm action={disconnectStoreAction} submit="Disconnect" buttonClass="btn-ghost py-1">
        <input type="hidden" name="id" value={store.id} />
      </ActionForm>
    </section>
  );
}

export default async function StorePage() {
  const user = await requireUser();
  const [stores, orders] = await Promise.all([
    prisma.storeConnection.findMany({ where: { orgId: user.orgId } }),
    prisma.order.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: 'desc' }, take: 25 }),
  ]);
  const host = (await headers()).get('host') ?? 'localhost:3000';
  const base = `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`;

  return (
    <>
      <PageHeader
        title="Online store"
        description="Send WhatsApp messages automatically when orders come in on your Shopify or WooCommerce store. No code needed."
      />

      {!planOf(user.org.plan).storeAutomations && (
        <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-amber-50 p-5 ring-1 ring-amber-200">
          <div>
            <p className="font-semibold text-amber-900">Store messages are part of the Growth plan</p>
            <p className="text-sm text-amber-800">You can set everything up now. Messages start once you upgrade.</p>
          </div>
          <Link href="/dashboard/wallet#plan" className="btn">
            See plans
          </Link>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {(['shopify', 'woocommerce'] as const).map((platform) => (
          <StoreCard key={platform} platform={platform} store={stores.find((s) => s.platform === platform)} base={base} />
        ))}
      </div>

      <section className="card mt-6">
        <h2 className="mb-4 text-lg font-bold">Recent orders</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Buyer confirmed?</th>
                <th>From</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="font-medium">{o.number}</td>
                  <td>
                    {o.customerName}
                    <span className="block text-xs text-slate-500">+{o.phone}</span>
                  </td>
                  <td>{o.amount}</td>
                  <td>{o.cod ? 'Cash on delivery' : 'Prepaid'}</td>
                  <td>{o.codStatus ? <Badge value={o.codStatus === 'PENDING' ? 'WAITING' : o.codStatus} /> : '—'}</td>
                  <td className="capitalize">{o.source}</td>
                  <td className="whitespace-nowrap">{formatTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Orders appear here once your store sends them.</p>}
        </div>
      </section>
    </>
  );
}
