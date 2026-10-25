import { ApiError } from './errors';

export const LANGUAGE = 'en_US';

export interface Field {
  name: string;
  label: string;
  example: string;
}

/** A ready-made message: we create its template in every connected account, the customer just calls the API. */
export interface UseCase {
  key: string;
  title: string;
  description: string;
  template: string;
  /** Positional {{n}} variables, in `fields` order. Meta rejects bodies that start or end with a variable. */
  body: string;
  fields: Field[];
  /** Quick-reply buttons; taps come back as inbound messages */
  buttons?: string[];
}

export const COD_CONFIRM = 'Confirm order';
export const COD_CANCEL = 'Cancel order';

const name: Field = { name: 'name', label: 'Customer name', example: 'Rahul' };
const orderId: Field = { name: 'order_id', label: 'Order ID', example: '#1234' };

export const USE_CASES: UseCase[] = [
  {
    key: 'order_confirmed',
    title: 'Order confirmation',
    description: 'Send when a customer places an order.',
    template: 'order_confirmed_v1',
    body: 'Hi {{1}}, thank you for your order! Your order {{2}} for {{3}} is confirmed. We will message you when it ships.',
    fields: [name, orderId, { name: 'amount', label: 'Order total', example: '₹499' }],
  },
  {
    key: 'order_shipped',
    title: 'Order shipped',
    description: 'Send when the order leaves your warehouse.',
    template: 'order_shipped_v1',
    body: 'Hi {{1}}, your order {{2}} has been shipped. Track it here: {{3}} Thank you for shopping with us.',
    fields: [name, orderId, { name: 'tracking_link', label: 'Tracking link', example: 'https://example.com/track/1234' }],
  },
  {
    key: 'order_delivered',
    title: 'Order delivered',
    description: 'Send when the order is delivered.',
    template: 'order_delivered_v1',
    body: 'Hi {{1}}, your order {{2}} has been delivered. We hope you love it!',
    fields: [name, orderId],
  },
  {
    key: 'payment_reminder',
    title: 'Payment reminder',
    description: 'Remind a customer about a due payment.',
    template: 'payment_reminder_v1',
    body: 'Hi {{1}}, this is a reminder that your payment of {{2}} for {{3}} is due on {{4}}. Please ignore this message if you have already paid.',
    fields: [
      name,
      { name: 'amount', label: 'Amount', example: '₹1,200' },
      { name: 'purpose', label: 'For', example: 'invoice INV-102' },
      { name: 'due_date', label: 'Due date', example: '30 Oct' },
    ],
  },
  {
    key: 'appointment_reminder',
    title: 'Appointment reminder',
    description: 'Remind a customer about a booking.',
    template: 'appointment_reminder_v1',
    body: 'Hi {{1}}, this is a reminder of your appointment with {{2}} on {{3}}. Reply to this message if you need to reschedule.',
    fields: [
      name,
      { name: 'business', label: 'With', example: 'Dr. Mehta Clinic' },
      { name: 'time', label: 'Date and time', example: '25 Oct, 5:30 PM' },
    ],
  },
  {
    key: 'cod_confirmation',
    title: 'Cash-on-delivery confirmation',
    description: 'Asks the buyer to confirm a COD order with one tap, so you don’t ship fake orders.',
    template: 'cod_confirmation_v1',
    body: 'Hi {{1}}, thanks for your order {{2}} of {{3}} with cash on delivery. Please confirm it with a tap below so we can ship it.',
    fields: [name, orderId, { name: 'amount', label: 'Order total', example: '₹1,299' }],
    buttons: [COD_CONFIRM, COD_CANCEL],
  },
];

export const useCase = (key: string) => USE_CASES.find((u) => u.key === key);

export const templateDefinition = (u: UseCase) => ({
  name: u.template,
  language: LANGUAGE,
  category: 'UTILITY',
  components: [
    { type: 'BODY', text: u.body, example: { body_text: [u.fields.map((f) => f.example)] } },
    ...(u.buttons ? [{ type: 'BUTTONS', buttons: u.buttons.map((text) => ({ type: 'QUICK_REPLY', text })) }] : []),
  ],
});

/** Meta rejects parameters containing newlines, tabs or more than 4 spaces in a row. */
export const cleanParam = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

export function variablesFor(u: UseCase, input: Record<string, unknown>) {
  return u.fields.map((f) => {
    const value = cleanParam(input[f.name]);
    if (!value) throw new ApiError(400, 'missing_field', `\`${f.name}\` (${f.label}) is required`);
    return value;
  });
}

/** Meta's India list prices before GST, shown next to our fee while Meta bills customers directly. */
export const META_PRICE_INR = { AUTHENTICATION: '0.115', UTILITY: '0.115', MARKETING: '0.8631' } as const;
