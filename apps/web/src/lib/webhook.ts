import { prisma, type MessageStatus } from '@wa/db';
import { decideSettlement } from '@wa/billing';
import type { WebhookEvent } from '@wa/meta';
import { parseMsisdn } from '@wa/shared';
import { refreshNumbers } from './connect';
import { handleCodReply } from './store';
import { priceFor, settleMessage } from './wallet';

// Statuses can arrive out of order; only move forward. FAILED is terminal.
const RANK: Partial<Record<MessageStatus, number>> = { QUEUED: 0, ACCEPTED: 1, SENT: 2, DELIVERED: 3, READ: 4 };
const STATUS: Record<string, MessageStatus> = { sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' };

type StatusEvent = Extract<WebhookEvent, { type: 'status' }>;
type InboundEvent = Extract<WebhookEvent, { type: 'message' }>;

export async function handleEvent(event: WebhookEvent) {
  switch (event.type) {
    case 'status':
      return handleStatus(event);
    case 'message':
      return handleInbound(event);
    case 'template_status':
      await prisma.template.updateMany({ where: { metaTemplateId: event.templateId }, data: { status: event.status } });
      return;
    case 'other':
      if (event.field === 'phone_number_quality_update' || event.field === 'account_update') {
        const waba = await prisma.waba.findUnique({ where: { metaWabaId: event.wabaId } });
        if (waba) await refreshNumbers(waba.id);
      }
  }
}

async function handleStatus(event: StatusEvent) {
  const message = await prisma.message.findUnique({
    where: { metaMessageId: event.messageId },
    include: { org: true, phoneNumber: { include: { waba: true } } },
  });
  if (!message) return; // sent by another tool on the same number

  const next = STATUS[event.status];
  const current = RANK[message.status] ?? Number.POSITIVE_INFINITY;
  const advance = next === 'FAILED' ? current < RANK.DELIVERED! : next !== undefined && RANK[next]! > current;
  if (next && advance) {
    const error = event.errors?.[0];
    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: next,
        ...(error ? { errorCode: error.code, errorMessage: error.error_data?.details ?? error.message ?? error.title ?? null } : {}),
      },
    });
  }

  const decision = decideSettlement(event.status, event.pricing);
  if (decision.kind === 'release') await settleMessage(message.id, { kind: 'release' });
  if (decision.kind === 'capture') {
    const charge = await priceFor(message.org.plan, decision.category, message.country ?? 'ZZ', message.phoneNumber.waba.billingMode);
    await settleMessage(message.id, { kind: 'capture', charge }, decision.category);
  }
}

async function handleInbound(event: InboundEvent) {
  const phone = await prisma.phoneNumber.findUnique({ where: { metaPhoneNumberId: event.phoneNumberId }, include: { waba: true } });
  if (!phone) return;
  await prisma.message.upsert({
    where: { metaMessageId: event.messageId },
    create: {
      orgId: phone.waba.orgId,
      phoneNumberId: phone.id,
      direction: 'IN',
      metaMessageId: event.messageId,
      contact: event.from,
      country: parseMsisdn(event.from)?.country ?? null,
      type: event.messageType,
      body: event.text ?? null,
      status: 'RECEIVED',
      createdAt: event.at,
    },
    update: {},
  });
  if (/^\s*(stop|unsubscribe)\s*$/i.test(event.text ?? '')) {
    await prisma.contact.updateMany({ where: { orgId: phone.waba.orgId, phone: event.from }, data: { optedOut: true } });
  }
  if (event.contextId && event.text) await handleCodReply(phone.waba.orgId, event.contextId, event.from, event.text);
}
