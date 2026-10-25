import { after } from 'next/server';
import { prisma } from '@wa/db';
import { decrypt } from '@/lib/crypto';
import { handleStoreEvent, sendDueCartReminders, verifyStoreSignature } from '@/lib/store';

/**
 * Order webhooks from a customer's store. The token in the URL identifies the store;
 * WooCommerce always signs (with our secret), Shopify signs once its secret is saved.
 */
export async function POST(req: Request, { params }: { params: Promise<{ platform: string; token: string }> }) {
  const { platform, token } = await params;
  const store = await prisma.storeConnection.findUnique({ where: { token } });
  if (!store || store.platform !== platform) return new Response('Not found', { status: 404 });

  const raw = await req.text();
  // WooCommerce checks a new webhook URL with a form-encoded ping.
  if (platform === 'woocommerce' && !raw.trimStart().startsWith('{')) return new Response('OK');
  const signature = req.headers.get(platform === 'woocommerce' ? 'x-wc-webhook-signature' : 'x-shopify-hmac-sha256');
  if (store.secret && !verifyStoreSignature(raw, signature, decrypt(store.secret))) {
    return new Response('Invalid signature', { status: 401 });
  }

  const topic = req.headers.get('x-shopify-topic') ?? req.headers.get('x-wc-webhook-topic') ?? '';
  try {
    await handleStoreEvent(store, topic, JSON.parse(raw));
  } catch (err) {
    // Still 200: stores disable webhooks that keep failing. Send failures show in the message log.
    console.error(`Store webhook ${platform} ${topic} failed`, err);
  }
  // Store traffic also drives cart reminders, so they go out on time even without a frequent cron.
  after(() => sendDueCartReminders().catch((err) => console.error('Cart reminders failed', err)));
  return new Response('OK');
}
