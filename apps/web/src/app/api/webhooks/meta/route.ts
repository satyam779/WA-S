import { prisma } from '@wa/db';
import { parseWebhook, verifySignature } from '@wa/meta';
import { env } from '@/lib/env';
import { handleEvent } from '@/lib/webhook';

/** Meta's one-time verification handshake when the callback URL is saved in the App Dashboard. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const ok = params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === env.metaVerifyToken;
  return ok ? new Response(params.get('hub.challenge') ?? '') : new Response('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'), env.metaAppSecret)) {
    return new Response('Invalid signature', { status: 401 });
  }
  const payload = JSON.parse(raw);
  const log = await prisma.webhookLog.create({ data: { payload } });
  try {
    for (const event of parseWebhook(payload)) await handleEvent(event);
    return new Response('OK');
  } catch (err) {
    // Processing is idempotent, so let Meta retry; the raw payload is kept for replay.
    console.error('Webhook processing failed', err);
    await prisma.webhookLog.update({ where: { id: log.id }, data: { error: String(err) } });
    return new Response('Retry later', { status: 500 });
  }
}
