'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { prisma, type Prisma } from '@wa/db';
import { MetaApiError, exchangeSignupCode } from '@wa/meta';
import type { ActionResult } from '@/components/action-form';
import { forgetLogins, requireUser } from '@/lib/auth';
import { createCampaign, importContacts, processCampaign } from '@/lib/campaigns';
import { connectWaba, refreshNumbers, setupTemplates, syncTemplates } from '@/lib/connect';
import { encrypt, randomToken, sha256 } from '@/lib/crypto';
import { env } from '@/lib/env';
import { ApiError } from '@/lib/errors';
import { graphFor } from '@/lib/meta';
import { sendOtp } from '@/lib/otp';
import { confirmRecharge, createRechargeOrder } from '@/lib/payments';
import { changePlan } from '@/lib/plans';
import { sendMessage } from '@/lib/send';
import { PLATFORMS } from '@/lib/store';
import { LANGUAGE, useCase, variablesFor } from '@/lib/use-cases';

const field = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

const latestWaba = (orgId: string) => prisma.waba.findFirst({ where: { orgId }, orderBy: { connectedAt: 'desc' } });

async function requireWaba(orgId: string) {
  const waba = await latestWaba(orgId);
  if (!waba) throw new ApiError(409, 'not_connected', 'Connect WhatsApp first');
  return waba;
}

async function attempt(work: () => Promise<ActionResult | string>): Promise<ActionResult> {
  try {
    const result = await work();
    revalidatePath('/', 'layout');
    return typeof result === 'string' ? { ok: result } : result;
  } catch (err) {
    if (err instanceof ApiError || err instanceof MetaApiError) return { error: err.message };
    console.error(err);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export async function completeSignupAction(input: { code: string; wabaId?: string; phoneNumberId?: string }) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    if (!input.wabaId || !input.phoneNumberId) {
      throw new ApiError(400, 'incomplete', 'Signup finished without a phone number. Please try again and add your number.');
    }
    const accessToken = await exchangeSignupCode({
      appId: process.env.META_APP_ID ?? '',
      appSecret: env.metaAppSecret,
      code: input.code,
      version: env.metaGraphVersion,
    });
    await connectWaba(orgId, input.wabaId, input.phoneNumberId, { accessToken });
    return 'WhatsApp connected. Meta is reviewing your message templates; this can take up to 24 hours.';
  });
}

export async function connectAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    await connectWaba(orgId, field(data, 'wabaId'), field(data, 'phoneNumberId'), { pin: field(data, 'pin') || undefined });
    return 'WhatsApp connected';
  });
}

/** Every page and send uses the most recently connected account, so switching moves this one to the front. */
export async function switchNumberAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const { count } = await prisma.waba.updateMany({ where: { id: field(data, 'wabaId'), orgId }, data: { connectedAt: new Date() } });
    if (!count) throw new ApiError(404, 'not_connected', 'That number is no longer connected');
    return 'Messages now go out from this number.';
  });
}

export async function replyAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const text = field(data, 'text');
    if (!text) throw new ApiError(400, 'empty_message', 'Type a message first');
    await sendMessage(orgId, { to: field(data, 'to'), text: text.slice(0, 4096) });
    return 'Sent';
  });
}

export async function refreshStatus() {
  const { orgId } = await requireUser();
  const waba = await latestWaba(orgId);
  if (waba) {
    await Promise.all([refreshNumbers(waba.id), syncTemplates(waba.id)]).catch((err) => console.error('Status refresh failed', err));
  }
  revalidatePath('/', 'layout');
}

export async function syncTemplatesAction(_: ActionResult, _data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => `Synced ${await syncTemplates((await requireWaba(orgId)).id)} templates`);
}

export async function setupTemplatesAction(_: ActionResult, _data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const failed = await setupTemplates((await requireWaba(orgId)).id);
    if (failed.length) throw new ApiError(502, 'setup_failed', `Meta didn't accept: ${failed.join(', ')}. Check the server log.`);
    return 'Ready-made templates are set up';
  });
}

export async function createTemplateAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const waba = await requireWaba(orgId);
    const name = field(data, 'name').toLowerCase();
    if (!/^[a-z0-9_]{3,60}$/.test(name)) throw new ApiError(400, 'invalid_name', 'Name: 3–60 lowercase letters, numbers or underscores');
    const category = field(data, 'category') === 'UTILITY' ? 'UTILITY' : 'MARKETING';
    const body = field(data, 'body');
    const numbers = [...new Set(body.match(/\{\{\d+\}\}/g) ?? [])].map((v) => Number(v.slice(2, -2))).sort((a, b) => a - b);
    if (numbers.some((n, i) => n !== i + 1)) throw new ApiError(400, 'variables', 'Number the variables {{1}}, {{2}}… in order');
    const examples = field(data, 'examples') ? field(data, 'examples').split(',').map((s) => s.trim()) : [];
    if (examples.length !== numbers.length) {
      throw new ApiError(400, 'examples', `Give ${numbers.length} example value${numbers.length === 1 ? '' : 's'}, separated by commas`);
    }

    const components: object[] = [{ type: 'BODY', text: body, ...(numbers.length ? { example: { body_text: [examples] } } : {}) }];
    if (field(data, 'footer')) components.push({ type: 'FOOTER', text: field(data, 'footer') });
    if (field(data, 'buttonText') && field(data, 'buttonUrl')) {
      components.push({ type: 'BUTTONS', buttons: [{ type: 'URL', text: field(data, 'buttonText'), url: field(data, 'buttonUrl') }] });
    }
    const created = await graphFor(waba).createTemplate(waba.metaWabaId, { name, language: LANGUAGE, category, components });
    await prisma.template.create({
      data: {
        wabaId: waba.id,
        metaTemplateId: created.id,
        name,
        language: LANGUAGE,
        category: created.category ?? category,
        status: created.status,
        components: components as Prisma.InputJsonValue,
      },
    });
    return `Submitted to Meta (status: ${created.status}). Review can take up to 24 hours.`;
  });
}

export async function createApiKeyAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const key = `wa_live_${randomToken(24)}`;
    await prisma.apiKey.create({
      data: { orgId, name: field(data, 'name') || 'Default', prefix: key.slice(0, 12), hash: sha256(key) },
    });
    return { ok: 'Copy this key now. It won’t be shown again.', secret: key };
  });
}

export async function revokeApiKeyAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    await prisma.apiKey.updateMany({ where: { id: field(data, 'id'), orgId }, data: { revokedAt: new Date() } });
    return 'Key revoked';
  });
}

export async function sendTestOtpAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const { requestId } = await sendOtp(orgId, { phone: field(data, 'phone') });
    return `OTP sent (request ${requestId})`;
  });
}

export async function sendUseCaseTestAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const u = useCase(field(data, 'useCase'));
    if (!u) throw new ApiError(400, 'unknown_use_case', 'Unknown use case');
    const values = Object.fromEntries(u.fields.map((f) => [f.name, field(data, f.name)]));
    const message = await sendMessage(orgId, {
      to: field(data, 'phone'),
      template: { name: u.template, language: LANGUAGE, variables: variablesFor(u, values) },
    });
    return `Sent. Track it in Messages (${message.id})`;
  });
}

export async function sendTestMessageAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const [name = '', language = LANGUAGE] = field(data, 'template').split('|');
    const raw = field(data, 'variables');
    const variables = raw ? raw.split(',').map((v) => v.trim()) : [];
    const message = await sendMessage(orgId, { to: field(data, 'phone'), template: { name, language, variables } });
    return `Message accepted (${message.id})`;
  });
}

export async function importContactsAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    if (data.get('consent') !== 'on') throw new ApiError(400, 'consent', 'Confirm that these people agreed to receive WhatsApp messages from you');
    const file = data.get('file');
    const text = [field(data, 'contacts'), file instanceof File && file.size ? await file.text() : ''].join('\n');
    const { added, duplicates, invalid } = await importContacts(orgId, text);
    return `Added ${added} contacts${duplicates ? `, ${duplicates} already existed` : ''}${invalid ? `, skipped ${invalid} invalid lines` : ''}`;
  });
}

export async function createCampaignAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const raw = field(data, 'variables');
    const campaign = await createCampaign(orgId, {
      name: field(data, 'name'),
      template: field(data, 'template'),
      variables: raw ? raw.split(',').map((v) => v.trim()) : [],
    });
    after(() => processCampaign(campaign.id, Date.now() + 55_000));
    return `Sending to ${campaign.total} contacts. Progress shows below; refresh to update.`;
  });
}

export async function resumeCampaignAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const { count } = await prisma.campaign.updateMany({
      where: { id: field(data, 'id'), orgId, status: { in: ['PAUSED', 'SENDING'] } },
      data: { status: 'SENDING', error: null },
    });
    if (count) after(() => processCampaign(field(data, 'id'), Date.now() + 55_000));
    return 'Sending continues';
  });
}

export async function createRechargeOrderAction(amount: string) {
  const { orgId } = await requireUser();
  try {
    return await createRechargeOrder(orgId, amount);
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : 'Could not start the payment' };
  }
}

export async function confirmRechargeAction(payment: { orderId: string; paymentId: string; signature: string }) {
  const { orgId } = await requireUser();
  return attempt(async () => `${await confirmRecharge(orgId, payment)} added to your wallet`);
}

export async function changePlanAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const message = await changePlan(orgId, field(data, 'plan'));
    forgetLogins(orgId);
    return message;
  });
}

export async function connectStoreAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const platform = field(data, 'platform');
    if (!(PLATFORMS as readonly string[]).includes(platform)) throw new ApiError(400, 'unknown_platform', 'Unknown store type');
    await prisma.storeConnection.upsert({
      where: { orgId_platform: { orgId, platform } },
      // WooCommerce lets us choose the signing secret; Shopify shows its own, which the user pastes later.
      create: { orgId, platform, token: randomToken(24), secret: platform === 'woocommerce' ? encrypt(randomToken(24)) : null },
      update: {},
    });
    return 'Now add the webhook in your store, using the steps below.';
  });
}

export async function saveStoreAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    const store = await prisma.storeConnection.findFirst({ where: { id: field(data, 'id'), orgId } });
    if (!store) throw new ApiError(404, 'not_found', 'Store not found');
    const on = (name: string) => data.get(name) === 'on';
    const signingSecret = field(data, 'signingSecret');
    await prisma.storeConnection.update({
      where: { id: store.id },
      data: {
        sendConfirmed: on('sendConfirmed'),
        codConfirm: on('codConfirm'),
        sendShipped: on('sendShipped'),
        sendDelivered: on('sendDelivered'),
        ...(store.platform === 'shopify' && signingSecret ? { secret: encrypt(signingSecret) } : {}),
      },
    });
    return 'Saved';
  });
}

export async function disconnectStoreAction(_: ActionResult, data: FormData) {
  const { orgId } = await requireUser();
  return attempt(async () => {
    await prisma.storeConnection.deleteMany({ where: { id: field(data, 'id'), orgId } });
    return 'Disconnected. Delete the webhooks in your store as well.';
  });
}
