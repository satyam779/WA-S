import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@wa/db';
import { formatRupees, gstOn, rupees, toPaiseCeil } from '@wa/billing';
import { ApiError } from './errors';
import { creditWallet } from './wallet';

export const rechargeEnabled = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

function keys() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new ApiError(503, 'recharge_unavailable', 'Online recharge is not set up yet');
  return { id, secret };
}

/** The customer pays the credit plus 18% GST; the wallet receives the credit. */
export async function createRechargeOrder(orgId: string, amountRupees: string) {
  const { id, secret } = keys();
  if (!/^\d{1,6}$/.test(amountRupees) || Number(amountRupees) < 100) {
    throw new ApiError(400, 'invalid_amount', 'Recharge at least ₹100, in whole rupees');
  }
  const credit = rupees(amountRupees);
  const gst = gstOn(credit);
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: toPaiseCeil(credit + gst), currency: 'INR', notes: { orgId } }),
  });
  const order = (await response.json()) as { id?: string; amount?: number; error?: { description?: string } };
  if (!response.ok || !order.id || !order.amount) {
    throw new ApiError(502, 'razorpay_error', order.error?.description ?? 'Could not start the payment');
  }
  await prisma.payment.create({
    data: { orgId, razorpayOrderId: order.id, creditMicros: BigInt(credit), gstMicros: BigInt(gst) },
  });
  return { keyId: id, orderId: order.id, amount: order.amount, label: `${formatRupees(credit)} + ${formatRupees(gst)} GST` };
}

const signatureMatches = (payload: string, signature: string | null | undefined, secret: string) => {
  const expected = createHmac('sha256', secret).update(payload).digest();
  const given = Buffer.from(String(signature ?? ''), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
};

/** Marks an order paid and credits the wallet exactly once, however many times the payment is reported. */
function creditPaidOrder(orderId: string, paymentId: string, orgId?: string) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.payment.findUnique({ where: { razorpayOrderId: orderId } });
    if (!row || (orgId && row.orgId !== orgId)) throw new ApiError(404, 'unknown_order', 'Payment not found');
    const { count } = await tx.payment.updateMany({
      where: { id: row.id, status: 'CREATED' },
      data: { status: 'PAID', razorpayPaymentId: paymentId },
    });
    if (count) await creditWallet(row.orgId, Number(row.creditMicros), 'cash', `Recharge ${paymentId}`, tx);
    return formatRupees(Number(row.creditMicros));
  });
}

/** Verifies Razorpay's checkout signature when the buyer returns to the page. */
export async function confirmRecharge(orgId: string, payment: { orderId: string; paymentId: string; signature: string }) {
  const { secret } = keys();
  if (!signatureMatches(`${payment.orderId}|${payment.paymentId}`, payment.signature, secret)) {
    throw new ApiError(400, 'bad_signature', 'The payment could not be verified');
  }
  return creditPaidOrder(payment.orderId, payment.paymentId, orgId);
}

/**
 * Razorpay webhook (order.paid / payment.captured): credits payments whose buyer closed the page
 * before Razorpay sent them back. Returns the HTTP status to answer with.
 */
export async function handleRazorpayWebhook(raw: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return 503;
  if (!signatureMatches(raw, signature, secret)) return 401;
  const event = JSON.parse(raw);
  const payment = event.payload?.payment?.entity;
  if ((event.event === 'order.paid' || event.event === 'payment.captured') && payment?.order_id && payment?.id) {
    // Orders we didn't create (other integrations on the same Razorpay account) are ignored.
    await creditPaidOrder(payment.order_id, payment.id).catch((err) => {
      if (!(err instanceof ApiError)) throw err;
    });
  }
  return 200;
}
