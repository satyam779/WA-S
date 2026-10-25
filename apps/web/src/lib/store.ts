import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma, type StoreConnection } from '@wa/db';
import { parseMsisdn } from '@wa/shared';
import { ApiError } from './errors';
import { planOf } from './plans';
import { sendMessage } from './send';
import { COD_CANCEL, COD_CONFIRM, LANGUAGE, useCase, variablesFor } from './use-cases';

/** How long a Shopify checkout must sit unfinished before we send the cart reminder. */
const CART_DELAY_MS = 60 * 60_000;

export const PLATFORMS = ['shopify', 'woocommerce'] as const;

/** An order as both stores describe it, reduced to what our messages need. */
interface StoreOrder {
  externalId: string;
  number: string;
  name: string;
  phone: string | null;
  amount: string;
  cod: boolean;
}

/** Shopify and WooCommerce both sign webhooks with a base64 HMAC-SHA256 of the raw body. */
export function verifyStoreSignature(raw: string, header: string | null, secret: string) {
  if (!header) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const given = Buffer.from(header, 'base64');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const money = (amount: unknown, currency = 'INR') => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount ?? '');
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
};

const firstName = (...names: unknown[]) => names.map((n) => String(n ?? '').trim()).find(Boolean) ?? 'there';

function fromShopifyOrder(o: any): StoreOrder {
  const gateways: string[] = o.payment_gateway_names ?? [o.gateway].filter(Boolean);
  return {
    externalId: String(o.id),
    number: o.name ?? `#${o.order_number}`,
    name: firstName(o.customer?.first_name, o.shipping_address?.first_name, o.billing_address?.first_name),
    phone: o.phone ?? o.customer?.phone ?? o.shipping_address?.phone ?? o.billing_address?.phone ?? null,
    amount: money(o.total_price, o.currency),
    cod: gateways.some((g) => /cash on delivery|\bcod\b/i.test(g)),
  };
}

function fromWooOrder(o: any): StoreOrder {
  return {
    externalId: String(o.id),
    number: `#${o.number ?? o.id}`,
    name: firstName(o.billing?.first_name, o.shipping?.first_name),
    phone: o.billing?.phone || o.shipping?.phone || null,
    amount: money(o.total, o.currency),
    cod: o.payment_method === 'cod',
  };
}

const shopifyTracking = (o: any): string | null => {
  const latest = o.fulfillments?.at(-1);
  return latest?.tracking_url ?? latest?.tracking_urls?.[0] ?? o.order_status_url ?? null;
};

/** WooCommerce has no tracking link of its own; the customer's order page is the next best thing. */
const wooOrderPage = (o: any): string | null => {
  try {
    return `${new URL(o._links.self[0].href).origin}/my-account/view-order/${o.id}/`;
  } catch {
    return null;
  }
};

const orderKey = (orgId: string, source: string, externalId: string) => ({
  orgId_source_externalId: { orgId, source, externalId },
});

function send(orgId: string, key: string, phone: string, values: Record<string, string>, idempotencyKey: string) {
  const u = useCase(key)!;
  return sendMessage(orgId, { to: phone, template: { name: u.template, language: LANGUAGE, variables: variablesFor(u, values) }, idempotencyKey });
}

async function saveOrder(orgId: string, source: string, order: StoreOrder & { phone: string }) {
  return prisma.order.upsert({
    where: orderKey(orgId, source, order.externalId),
    create: {
      orgId,
      source,
      externalId: order.externalId,
      number: order.number,
      customerName: order.name,
      phone: order.phone,
      amount: order.amount,
      cod: order.cod,
    },
    update: {},
  });
}

/** Sends the Confirm/Cancel question and links it to the order, so the buyer's tap can update it. */
async function askCod(orgId: string, source: string, order: StoreOrder & { phone: string }) {
  const message = await send(orgId, 'cod_confirmation', order.phone, { name: order.name, order_id: order.number, amount: order.amount }, `${source}:${order.externalId}:cod`);
  // Only the first time: a repeated webhook must not undo the buyer's answer.
  await prisma.order.updateMany({
    where: { orgId, source, externalId: order.externalId, codStatus: null },
    data: { codStatus: 'PENDING', confirmMessageId: message.id },
  });
  return message;
}

async function onOrderPlaced(store: StoreConnection, order: StoreOrder, checkoutToken?: string) {
  if (checkoutToken) {
    await prisma.cartReminder.updateMany({ where: { orgId: store.orgId, checkoutId: checkoutToken, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  }
  const phone = order.phone ? parseMsisdn(order.phone)?.digits : undefined;
  if (!phone) return;
  const withPhone = { ...order, phone };
  await saveOrder(store.orgId, store.platform, withPhone);
  if (order.cod && store.codConfirm) return askCod(store.orgId, store.platform, withPhone);
  if (store.sendConfirmed) {
    return send(store.orgId, 'order_confirmed', phone, { name: order.name, order_id: order.number, amount: order.amount }, `${store.platform}:${order.externalId}:confirmed`);
  }
}

async function onShipped(store: StoreConnection, order: StoreOrder, link: string | null) {
  const phone = order.phone ? parseMsisdn(order.phone)?.digits : undefined;
  if (!store.sendShipped || !phone || !link) return;
  return send(store.orgId, 'order_shipped', phone, { name: order.name, order_id: order.number, tracking_link: link }, `${store.platform}:${order.externalId}:shipped`);
}

async function onDelivered(store: StoreConnection, fulfillment: any) {
  if (!store.sendDelivered) return;
  const externalId = String(fulfillment.order_id);
  // Prefer the details we saved when the order was placed; delivery updates carry less.
  const saved = await prisma.order.findUnique({ where: orderKey(store.orgId, store.platform, externalId) });
  const phone = saved?.phone ?? parseMsisdn(String(fulfillment.destination?.phone ?? ''))?.digits;
  if (!phone) return;
  const number = saved?.number ?? (String(fulfillment.name ?? '').split('.')[0] || `#${externalId}`);
  const name = saved?.customerName ?? firstName(fulfillment.destination?.first_name);
  return send(store.orgId, 'order_delivered', phone, { name, order_id: number }, `${store.platform}:${externalId}:delivered`);
}

/** Shopify checkouts: remember unfinished ones from shoppers who accepted marketing; the cron sends the reminder. */
async function onCheckout(store: StoreConnection, c: any) {
  const checkoutId = String(c.token ?? c.id);
  if (c.completed_at) {
    await prisma.cartReminder.updateMany({ where: { orgId: store.orgId, checkoutId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    return;
  }
  // Cart reminders are marketing messages, so they need the shopper's consent.
  if (!store.cartReminder || !(c.buyer_accepts_marketing || c.buyer_accepts_sms_marketing)) return;
  const phone = parseMsisdn(String(c.phone ?? c.shipping_address?.phone ?? c.billing_address?.phone ?? c.customer?.phone ?? ''))?.digits;
  if (!phone || !c.abandoned_checkout_url) return;
  await prisma.cartReminder.upsert({
    where: { orgId_source_checkoutId: { orgId: store.orgId, source: store.platform, checkoutId } },
    create: {
      orgId: store.orgId,
      source: store.platform,
      checkoutId,
      phone,
      name: firstName(c.customer?.first_name, c.shipping_address?.first_name, c.billing_address?.first_name),
      url: c.abandoned_checkout_url,
      sendAt: new Date(Date.now() + CART_DELAY_MS),
    },
    update: { phone, url: c.abandoned_checkout_url },
  });
}

/** Routes one store webhook. Shopify topics look like `orders/create`, WooCommerce ones like `order.updated`. */
export async function handleStoreEvent(store: StoreConnection, topic: string, body: any) {
  await prisma.storeConnection.update({ where: { id: store.id }, data: { lastEventAt: new Date() } });
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: store.orgId } });
  if (!planOf(org.plan).storeAutomations) return;

  switch (topic) {
    case 'orders/create':
      return onOrderPlaced(store, fromShopifyOrder(body), body.checkout_token ?? undefined);
    case 'orders/fulfilled':
      return onShipped(store, fromShopifyOrder(body), shopifyTracking(body));
    case 'fulfillments/update':
      if (body.shipment_status === 'delivered') return onDelivered(store, body);
      return;
    case 'checkouts/create':
    case 'checkouts/update':
      return onCheckout(store, body);
    case 'order.created':
    case 'order.updated':
      // "processing" = paid, or cash on delivery; "completed" = shipped.
      if (body.status === 'processing') return onOrderPlaced(store, fromWooOrder(body));
      if (body.status === 'completed') return onShipped(store, fromWooOrder(body), wooOrderPage(body));
  }
}

/** COD confirmation sent through the API (POST /api/v1/notify/cod_confirmation). */
export async function apiCodConfirmation(orgId: string, body: Record<string, unknown>) {
  const [name = '', number = '', amount = ''] = variablesFor(useCase('cod_confirmation')!, body);
  const phone = parseMsisdn(String(body.phone ?? ''))?.digits;
  if (!phone) throw new ApiError(400, 'invalid_phone', `Invalid phone number: ${body.phone}`);
  const order = { externalId: number, number, name, phone, amount, cod: true };
  await saveOrder(orgId, 'api', order);
  return askCod(orgId, 'api', order);
}

/** A buyer tapped Confirm or Cancel under a COD question. Updates the order and thanks them. */
export async function handleCodReply(orgId: string, contextId: string, from: string, text: string) {
  const answer = text === COD_CONFIRM ? 'CONFIRMED' : text === COD_CANCEL ? 'CANCELLED' : null;
  if (!answer) return;
  const question = await prisma.message.findUnique({ where: { metaMessageId: contextId }, select: { id: true } });
  const order = question && (await prisma.order.findUnique({ where: { confirmMessageId: question.id } }));
  if (!order || order.orgId !== orgId) return;
  const { count } = await prisma.order.updateMany({ where: { id: order.id, codStatus: 'PENDING' }, data: { codStatus: answer } });
  if (!count) return;
  // Free: the buyer's tap opened the 24-hour customer service window.
  const reply =
    answer === 'CONFIRMED'
      ? `Thank you! Your order ${order.number} is confirmed and will be shipped soon.`
      : `Your order ${order.number} has been cancelled. We hope to see you again soon.`;
  await sendMessage(orgId, { to: from, text: reply, idempotencyKey: `cod-reply:${order.id}` }).catch((err) => console.error('COD reply failed', err));
}

/** Cron: sends cart reminders that are due. */
export async function sendDueCartReminders(limit = 50) {
  const due = await prisma.cartReminder.findMany({
    where: { status: 'PENDING', sendAt: { lte: new Date() } },
    include: { org: true },
    take: limit,
  });
  for (const r of due) {
    // Claim it first so overlapping cron runs can't send twice.
    const { count } = await prisma.cartReminder.updateMany({ where: { id: r.id, status: 'PENDING' }, data: { status: 'SENT' } });
    if (!count) continue;
    try {
      if (!planOf(r.org.plan).storeAutomations) throw new Error('Plan no longer includes store automations');
      await send(r.orgId, 'cart_reminder', r.phone, { name: r.name ?? 'there', cart_link: r.url }, `cart:${r.id}`);
    } catch (err) {
      console.error('Cart reminder failed', err);
      await prisma.cartReminder.update({ where: { id: r.id }, data: { status: 'FAILED' } });
    }
  }
}
