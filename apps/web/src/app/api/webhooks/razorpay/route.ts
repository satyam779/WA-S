import { handleRazorpayWebhook } from '@/lib/payments';

/** Razorpay Dashboard → Webhooks: this URL, events order.paid and payment.captured, secret = RAZORPAY_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  const status = await handleRazorpayWebhook(await req.text(), req.headers.get('x-razorpay-signature'));
  return new Response(status === 200 ? 'OK' : 'Rejected', { status });
}
