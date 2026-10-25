export const OTP_TEMPLATE_NAME = 'otp_code';

export interface SendPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template' | 'text';
  template?: { name: string; language: { code: string }; components?: unknown[] };
  text?: { body: string; preview_url?: boolean };
}

/** Authentication template with a copy-code button, created in each seller's WABA on connect. */
export function otpTemplateDefinition(expiryMinutes = 10, name = OTP_TEMPLATE_NAME, language = 'en_US') {
  return {
    name,
    language,
    category: 'AUTHENTICATION',
    message_send_ttl_seconds: expiryMinutes * 60,
    components: [
      { type: 'BODY', add_security_recommendation: true },
      { type: 'FOOTER', code_expiration_minutes: expiryMinutes },
      { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copy code' }] },
    ],
  };
}

/** Authentication templates take the code twice: in the body and in the copy-code button. */
export function otpMessage(to: string, code: string, template = OTP_TEMPLATE_NAME, language = 'en_US'): SendPayload {
  return templateMessage(to, template, language, [
    { type: 'body', parameters: [{ type: 'text', text: code }] },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
  ]);
}

export function templateMessage(to: string, name: string, language: string, components?: unknown[]): SendPayload {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: { name, language: { code: language }, ...(components?.length ? { components } : {}) },
  };
}

/** `{{1}}…{{n}}` body variables, the common case for utility templates. */
export const bodyVariables = (values: string[]) =>
  values.length ? [{ type: 'body', parameters: values.map((text) => ({ type: 'text', text })) }] : [];

/** Free-form text; Meta only delivers it inside the 24-hour customer service window. */
export function textMessage(to: string, body: string): SendPayload {
  return { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body } };
}
