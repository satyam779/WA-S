import { Prisma, prisma, type Message } from '@wa/db';
import { InsufficientBalanceError, NoRateError, formatRupees } from '@wa/billing';
import { META_ERROR, MetaApiError, bodyVariables, templateMessage, textMessage, type SendPayload } from '@wa/meta';
import { parseMsisdn, type MessageCategory } from '@wa/shared';
import { syncTemplates } from './connect';
import { ApiError } from './errors';
import { graphFor } from './meta';
import { holdForMessage, priceFor, settleMessage } from './wallet';

const lastSync = new Map<string, number>();

/** Pulls template statuses from Meta, at most once a minute per account. Returns whether it ran. */
async function resyncTemplates(wabaId: string) {
  if (Date.now() - (lastSync.get(wabaId) ?? 0) < 60_000) return false;
  lastSync.set(wabaId, Date.now());
  await syncTemplates(wabaId).catch((err) => console.error('Template sync failed', err));
  return true;
}

export interface SendInput {
  to: string;
  template?: { name: string; language?: string; variables?: string[]; components?: unknown[] };
  text?: string;
  idempotencyKey?: string;
}

export async function sendMessage(orgId: string, input: SendInput): Promise<Message> {
  const key = input.idempotencyKey;
  const existing = key && (await prisma.message.findUnique({ where: { orgId_idempotencyKey: { orgId, idempotencyKey: key } } }));
  if (existing) return existing;

  const recipient = parseMsisdn(String(input.to ?? ''));
  if (!recipient) throw new ApiError(400, 'invalid_phone', `Invalid phone number: ${input.to}`);
  if (!input.template === !input.text) throw new ApiError(400, 'invalid_request', 'Send either `template` or `text`');

  const waba = await prisma.waba.findFirst({
    where: { orgId },
    orderBy: { connectedAt: 'desc' },
    include: { org: true, phoneNumbers: { take: 1 } },
  });
  const sender = waba?.phoneNumbers[0];
  if (!waba || !sender) throw new ApiError(409, 'not_connected', 'Connect a WhatsApp number first');

  let category: MessageCategory = 'SERVICE';
  let payload: SendPayload;
  if (input.template) {
    const { name, language = 'en_US', variables = [], components } = input.template;
    const find = () => prisma.template.findUnique({ where: { wabaId_name_language: { wabaId: waba.id, name, language } } });
    let template = await find();
    // A missed status webhook can leave a template looking pending or missing; ask Meta before refusing.
    if (template?.status !== 'APPROVED' && (await resyncTemplates(waba.id))) template = await find();
    if (!template) throw new ApiError(404, 'template_not_found', `Template "${name}" (${language}) not found. Sync templates and retry.`);
    if (template.status !== 'APPROVED') throw new ApiError(422, 'template_not_approved', `Template "${name}" is ${template.status}`);
    category = template.category as MessageCategory;
    payload = templateMessage(recipient.digits, name, language, components ?? bodyVariables(variables.map(String)));
  } else {
    payload = textMessage(recipient.digits, String(input.text));
  }

  let message: Message;
  try {
    const { price } = await priceFor(waba.org.plan, category, recipient.country, waba.billingMode);
    message = await holdForMessage(orgId, price, {
      phoneNumberId: sender.id,
      contact: recipient.digits,
      country: recipient.country,
      type: payload.type,
      templateName: input.template?.name,
      body: input.text, // template variables are not stored: they may be OTP codes
      category,
      idempotencyKey: key,
    });
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      throw new ApiError(402, 'insufficient_balance', `Wallet balance too low: need ${formatRupees(err.required)}, available ${formatRupees(err.available)}`);
    }
    if (err instanceof NoRateError) throw new ApiError(422, 'no_rate', `No price configured for ${category} messages to ${recipient.country}`);
    if (key && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return prisma.message.findUniqueOrThrow({ where: { orgId_idempotencyKey: { orgId, idempotencyKey: key } } });
    }
    throw err;
  }

  try {
    const result = await graphFor(waba).send(sender.metaPhoneNumberId, payload);
    return await prisma.message.update({
      where: { id: message.id },
      data: { metaMessageId: result.messages[0]?.id, status: 'ACCEPTED' },
    });
  } catch (err) {
    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: 'FAILED',
        errorCode: err instanceof MetaApiError ? err.code : null,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    await settleMessage(message.id, { kind: 'release' });
    if (err instanceof MetaApiError && err.code === META_ERROR.paymentMissing) {
      throw new ApiError(402, 'meta_payment_missing', 'Meta couldn’t charge your WhatsApp account. Add a payment method in WhatsApp Manager → Payment settings.');
    }
    if (err instanceof MetaApiError) throw new ApiError(err.retryable ? 503 : 422, 'meta_error', err.message);
    throw err;
  }
}

/** API representation; Prisma rows carry BigInt, which JSON can't encode. */
export const publicMessage = (m: Message) => ({
  id: m.id,
  direction: m.direction.toLowerCase(),
  to: m.contact,
  type: m.type,
  template: m.templateName,
  category: (m.billedCategory ?? m.category)?.toLowerCase() ?? null,
  status: m.status.toLowerCase(),
  charge: m.chargedMicros === null ? null : formatRupees(Number(m.chargedMicros)),
  error: m.errorCode || m.errorMessage ? { code: m.errorCode, message: m.errorMessage } : null,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
});
