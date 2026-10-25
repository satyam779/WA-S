import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { GraphClient, MetaApiError, otpMessage, parseWebhook, verifySignature } from '../src/index';

describe('verifySignature', () => {
  const body = '{"object":"whatsapp_business_account"}';
  const sign = (secret: string) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('accepts only a signature made with the app secret', () => {
    expect(verifySignature(body, sign('secret'), 'secret')).toBe(true);
    expect(verifySignature(body, sign('other'), 'secret')).toBe(false);
    expect(verifySignature(body, 'sha256=abc', 'secret')).toBe(false);
    expect(verifySignature(body, undefined, 'secret')).toBe(false);
  });
});

describe('parseWebhook', () => {
  it('flattens statuses, inbound messages and template updates', () => {
    const events = parseWebhook({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA1',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'PN1' },
                statuses: [
                  {
                    id: 'wamid.1',
                    status: 'delivered',
                    timestamp: '1761350400',
                    recipient_id: '919876543210',
                    pricing: { billable: true, pricing_model: 'PMP', category: 'authentication', type: 'regular' },
                  },
                ],
                messages: [{ id: 'wamid.2', from: '919876543210', timestamp: '1761350401', type: 'text', text: { body: 'hi' } }],
              },
            },
            {
              field: 'message_template_status_update',
              value: { event: 'APPROVED', message_template_id: 42, message_template_name: 'otp_code', message_template_language: 'en_US' },
            },
          ],
        },
      ],
    });

    expect(events.map((e) => e.type)).toEqual(['status', 'message', 'template_status']);
    expect(events[0]).toMatchObject({ wabaId: 'WABA1', phoneNumberId: 'PN1', messageId: 'wamid.1', pricing: { billable: true } });
    expect(events[1]).toMatchObject({ from: '919876543210', text: 'hi' });
    expect(events[2]).toMatchObject({ templateId: '42', status: 'APPROVED' });
  });

  it('ignores payloads for other objects', () => {
    expect(parseWebhook({ object: 'page', entry: [] })).toEqual([]);
  });
});

describe('GraphClient', () => {
  it('sends with a bearer token and maps Graph errors', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ messages: [{ id: 'wamid.9' }] }))
      .mockResolvedValueOnce(Response.json({ error: { code: 131056, message: 'Pair rate limit' } }, { status: 400 }));
    const client = new GraphClient({ accessToken: 'TOKEN', version: 'v24.0', fetch });

    const result = await client.send('PN1', otpMessage('919876543210', '482913'));
    expect(result.messages[0]?.id).toBe('wamid.9');
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('https://graph.facebook.com/v24.0/PN1/messages');
    expect(init.headers.Authorization).toBe('Bearer TOKEN');
    expect(JSON.parse(init.body).template.components[1]).toMatchObject({ sub_type: 'url', parameters: [{ text: '482913' }] });

    const error = await client.send('PN1', otpMessage('919876543210', '1')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetaApiError);
    expect(error).toMatchObject({ code: 131056, retryable: true });
  });
});
