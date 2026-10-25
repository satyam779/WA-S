import { prisma, type Prisma } from '@wa/db';
import { META_ERROR, MetaApiError, OTP_TEMPLATE_NAME, otpTemplateDefinition, type PhoneNumberInfo } from '@wa/meta';
import { encrypt, numericCode } from './crypto';
import { env } from './env';
import { ApiError } from './errors';
import { graph, graphFor, graphWithToken } from './meta';
import { LANGUAGE, USE_CASES, templateDefinition } from './use-cases';

const phoneFields = (p: PhoneNumberInfo) => ({
  displayPhoneNumber: p.display_phone_number,
  verifiedName: p.verified_name ?? null,
  qualityRating: p.quality_rating ?? null,
  status: p.status ?? null,
  messagingLimitTier: p.messaging_limit_tier ?? null,
});

/** Templates we create in every account, keyed by name. */
const READY_MADE = [
  { useCase: 'otp', definition: otpTemplateDefinition(10, OTP_TEMPLATE_NAME, LANGUAGE) },
  ...USE_CASES.map((u) => ({ useCase: u.key, definition: templateDefinition(u) })),
];
const useCaseOf = (templateName: string) => READY_MADE.find((t) => t.definition.name === templateName)?.useCase ?? null;

/**
 * Connects a customer's WhatsApp account, either from Embedded Signup (`accessToken` is their
 * business token) or manually after they assigned our business as partner (our system user).
 * Then subscribes our app to its webhooks, registers the number on Cloud API if needed and
 * creates the ready-made templates.
 */
export async function connectWaba(
  orgId: string,
  metaWabaId: string,
  metaPhoneNumberId: string,
  options: { pin?: string; accessToken?: string } = {},
) {
  const { pin, accessToken } = options;
  if (!/^\d{5,25}$/.test(metaWabaId) || !/^\d{5,25}$/.test(metaPhoneNumberId)) {
    throw new ApiError(400, 'invalid_ids', 'Both IDs are numeric. Copy them from WhatsApp Manager.');
  }
  if (pin && !/^\d{6}$/.test(pin)) throw new ApiError(400, 'invalid_pin', 'The two-step PIN has 6 digits');
  const lookalikes: Record<string, string> = { [process.env.META_APP_ID ?? '']: 'App ID', [process.env.META_BUSINESS_ID ?? '']: 'Business ID' };
  if (lookalikes[metaWabaId]) {
    throw new ApiError(400, 'invalid_ids', `${metaWabaId} is the ${lookalikes[metaWabaId]}, not a WhatsApp Business Account ID. Copy it from WhatsApp Manager or App Dashboard → WhatsApp → API Setup.`);
  }
  const taken = await prisma.waba.findUnique({ where: { metaWabaId } });
  if (taken && taken.orgId !== orgId) throw new ApiError(409, 'already_connected', 'This WhatsApp account is connected to another workspace');

  const meta = accessToken ? graphWithToken(accessToken) : graph();
  if (!accessToken) {
    try {
      await meta.assignSystemUser(metaWabaId, env.metaSystemUserId);
    } catch (err) {
      if (!(err instanceof MetaApiError)) throw err;
      // Subcode 33: no such object, or none we can see.
      if (err.subcode === 33) {
        throw new ApiError(400, 'unknown_waba', `Meta can't find WhatsApp Business Account ${metaWabaId} for us. Check it's the WhatsApp Business Account ID (not the App or Business ID) and that it's shared with business ID ${env.metaBusinessId}.`);
      }
      throw new ApiError(
        403,
        'not_shared',
        `We can't access this WhatsApp account yet. In WhatsApp Manager, assign partner business ID ${env.metaBusinessId} with full access, then try again. (Meta: ${err.message})`,
      );
    }
  }

  const [waba, phones] = await Promise.all([meta.getWaba(metaWabaId), meta.listPhoneNumbers(metaWabaId)]);
  const phone = phones.find((p) => p.id === metaPhoneNumberId);
  if (!phone) throw new ApiError(400, 'phone_not_in_waba', 'This Phone Number ID does not belong to that WhatsApp Business Account');

  await meta.subscribeApp(metaWabaId);

  let pinEncrypted: string | undefined;
  if (phone.platform_type !== 'CLOUD_API') {
    const registrationPin = pin || numericCode(6);
    try {
      await meta.registerPhone(metaPhoneNumberId, registrationPin);
    } catch (err) {
      if (err instanceof MetaApiError && err.code === META_ERROR.pinMismatch) {
        throw new ApiError(400, 'pin_required', 'This number already has a two-step verification PIN. Enter it below and connect again.');
      }
      throw err;
    }
    pinEncrypted = encrypt(registrationPin);
  }

  const wabaData = {
    name: waba.name,
    currency: waba.currency ?? null,
    reviewStatus: waba.account_review_status ?? null,
    connectedAt: new Date(),
    accessToken: accessToken ? encrypt(accessToken) : null,
  };
  const record = await prisma.waba.upsert({
    where: { metaWabaId },
    create: { orgId, metaWabaId, ...wabaData },
    update: wabaData,
  });
  await prisma.phoneNumber.upsert({
    where: { metaPhoneNumberId },
    create: { wabaId: record.id, metaPhoneNumberId, ...phoneFields(phone), pinEncrypted },
    update: { wabaId: record.id, ...phoneFields(phone), ...(pinEncrypted ? { pinEncrypted } : {}) },
  });

  await syncTemplates(record.id);
  await setupTemplates(record.id);
  return record;
}

export async function syncTemplates(wabaId: string) {
  const waba = await prisma.waba.findUniqueOrThrow({ where: { id: wabaId } });
  const templates = await graphFor(waba).listTemplates(waba.metaWabaId);
  await prisma.$transaction([
    prisma.template.deleteMany({ where: { wabaId, metaTemplateId: { notIn: templates.map((t) => t.id) } } }),
    ...templates.map((t) => {
      const data = {
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        components: (t.components ?? []) as Prisma.InputJsonValue,
        useCase: useCaseOf(t.name),
      };
      return prisma.template.upsert({ where: { metaTemplateId: t.id }, create: { wabaId, metaTemplateId: t.id, ...data }, update: data });
    }),
  ]);
  return templates.length;
}

/** Creates any ready-made template the account doesn't have yet. Returns the names that failed. */
export async function setupTemplates(wabaId: string) {
  const waba = await prisma.waba.findUniqueOrThrow({ where: { id: wabaId }, include: { templates: { select: { name: true } } } });
  const existing = new Set(waba.templates.map((t) => t.name));
  const failed: string[] = [];
  for (const { useCase, definition } of READY_MADE) {
    if (existing.has(definition.name)) continue;
    try {
      const created = await graphFor(waba).createTemplate(waba.metaWabaId, definition);
      await prisma.template.create({
        data: {
          wabaId,
          metaTemplateId: created.id,
          name: definition.name,
          language: definition.language,
          category: created.category ?? definition.category,
          status: created.status,
          components: definition.components as Prisma.InputJsonValue,
          useCase,
        },
      });
    } catch (err) {
      console.error(`Template ${definition.name} creation failed`, err);
      failed.push(definition.name);
    }
  }
  return failed;
}

/** Pulls quality rating, status and limit tier for every number on the WABA. */
export async function refreshNumbers(wabaId: string) {
  const waba = await prisma.waba.findUniqueOrThrow({ where: { id: wabaId }, include: { phoneNumbers: true } });
  for (const n of waba.phoneNumbers) {
    const info = await graphFor(waba).getPhoneNumber(n.metaPhoneNumberId);
    await prisma.phoneNumber.update({ where: { id: n.id }, data: phoneFields(info) });
  }
}
