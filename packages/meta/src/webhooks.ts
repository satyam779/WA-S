import { createHmac, timingSafeEqual } from 'node:crypto';

/** Checks `X-Hub-Signature-256` against the raw request body. */
export function verifySignature(rawBody: string | Buffer, header: string | null | undefined, appSecret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const given = Buffer.from(header.slice('sha256='.length), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface WebhookError {
  code: number;
  title?: string;
  message?: string;
  error_data?: { details?: string };
}

export type WebhookEvent =
  | {
      type: 'status';
      wabaId: string;
      phoneNumberId: string;
      messageId: string;
      status: string;
      at: Date;
      recipient: string;
      pricing?: { billable?: boolean; category?: string; type?: string; pricing_model?: string };
      errors?: WebhookError[];
    }
  | {
      type: 'message';
      wabaId: string;
      phoneNumberId: string;
      messageId: string;
      from: string;
      at: Date;
      messageType: string;
      text?: string;
      /** wamid of the message this replies to, e.g. a button tap */
      contextId?: string;
    }
  | { type: 'template_status'; wabaId: string; templateId: string; name: string; language: string; status: string; reason?: string }
  | { type: 'other'; wabaId: string; field: string; value: Record<string, unknown> };

interface Change {
  field: string;
  value: Record<string, any>;
}

interface Payload {
  object?: string;
  entry?: { id: string; changes?: Change[] }[];
}

const toDate = (unixSeconds: unknown) => new Date(Number(unixSeconds) * 1000);

/** Flattens a WhatsApp Business Account webhook into one event per status, message or update. */
export function parseWebhook(payload: unknown): WebhookEvent[] {
  const { object, entry = [] } = (payload ?? {}) as Payload;
  if (object !== 'whatsapp_business_account') return [];

  const events: WebhookEvent[] = [];
  for (const { id: wabaId, changes = [] } of entry) {
    for (const { field, value } of changes) {
      if (field === 'messages') {
        const phoneNumberId: string = value.metadata?.phone_number_id;
        for (const s of value.statuses ?? []) {
          events.push({
            type: 'status',
            wabaId,
            phoneNumberId,
            messageId: s.id,
            status: s.status,
            at: toDate(s.timestamp),
            recipient: s.recipient_id,
            pricing: s.pricing,
            errors: s.errors,
          });
        }
        for (const m of value.messages ?? []) {
          events.push({
            type: 'message',
            wabaId,
            phoneNumberId,
            messageId: m.id,
            from: m.from,
            at: toDate(m.timestamp),
            messageType: m.type,
            text: m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title,
            contextId: m.context?.id,
          });
        }
      } else if (field === 'message_template_status_update') {
        events.push({
          type: 'template_status',
          wabaId,
          templateId: String(value.message_template_id),
          name: value.message_template_name,
          language: value.message_template_language,
          status: value.event,
          reason: value.reason ?? undefined,
        });
      } else {
        events.push({ type: 'other', wabaId, field, value });
      }
    }
  }
  return events;
}
