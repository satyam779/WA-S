import { prisma } from '@wa/db';
import { formatRupees } from '@wa/billing';
import { parseMsisdn, type MessageCategory } from '@wa/shared';
import { ApiError } from './errors';
import { sendMessage } from './send';
import { cleanParam } from './use-cases';
import { priceFor } from './wallet';

const BATCH = 10;

/** Number of {{n}} variables in a template's body. */
export function bodyVariableCount(components: unknown) {
  const body = (Array.isArray(components) ? components : []).find((c) => c?.type === 'BODY');
  return new Set(String(body?.text ?? '').match(/\{\{\d+\}\}/g) ?? []).size;
}

/** One contact per line: `phone, name`. The customer confirms opt-in before importing. */
export async function importContacts(orgId: string, text: string) {
  const rows = new Map<string, string | null>();
  let invalid = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [rawPhone = '', ...rest] = line.split(/[,;\t]/);
    const phone = parseMsisdn(rawPhone.replace(/"/g, ''));
    if (!phone) {
      invalid++;
      continue;
    }
    rows.set(phone.digits, rest.join(' ').replace(/"/g, '').trim() || null);
  }
  const { count } = await prisma.contact.createMany({
    data: [...rows].map(([phone, name]) => ({ orgId, phone, name })),
    skipDuplicates: true,
  });
  return { added: count, duplicates: rows.size - count, invalid };
}

export async function createCampaign(orgId: string, input: { name: string; template: string; variables: string[] }) {
  const [templateName = '', language = 'en_US'] = input.template.split('|');
  const template = await prisma.template.findFirst({
    where: { waba: { orgId }, name: templateName, language, status: 'APPROVED', category: { not: 'AUTHENTICATION' } },
    include: { waba: { include: { org: true } } },
  });
  if (!template) throw new ApiError(404, 'template_not_found', 'Choose an approved template');
  const needed = bodyVariableCount(template.components);
  if (input.variables.length !== needed) {
    throw new ApiError(400, 'variables', `This template needs ${needed} value${needed === 1 ? '' : 's'}, separated by commas`);
  }

  const contacts = await prisma.contact.findMany({ where: { orgId, optedOut: false }, select: { phone: true, name: true } });
  if (!contacts.length) throw new ApiError(400, 'no_contacts', 'Import contacts first');

  // Check up front so a campaign doesn't stop halfway on an empty wallet.
  const { price } = await priceFor(template.waba.org.plan, template.category as MessageCategory, 'IN', template.waba.billingMode);
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { orgId } });
  const cost = price * contacts.length;
  const available = Number(wallet.balanceMicros - wallet.reservedMicros);
  if (cost > available) {
    throw new ApiError(402, 'insufficient_balance', `Sending to ${contacts.length} contacts costs up to ${formatRupees(cost)}, but your wallet has ${formatRupees(available)}. Recharge first.`);
  }

  return prisma.campaign.create({
    data: {
      orgId,
      name: input.name || template.name,
      templateName,
      language,
      variables: input.variables,
      total: contacts.length,
      recipients: { createMany: { data: contacts } },
    },
  });
}

type Result = { id: string; status: 'SENT' | 'FAILED'; messageId?: string; error?: string } | { id: string; pause: string };

/** Sends pending recipients until done, out of money, or past `deadline`; the cron resumes the rest. */
export async function processCampaign(campaignId: string, deadline = Date.now() + 50_000) {
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  if (campaign.status !== 'SENDING') return;
  const variables = campaign.variables as string[];

  while (Date.now() < deadline) {
    const batch = await prisma.campaignRecipient.findMany({ where: { campaignId, status: 'PENDING' }, take: BATCH });
    if (!batch.length) {
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'DONE', finishedAt: new Date() } });
      return;
    }

    const results = await Promise.all(
      batch.map(async (r): Promise<Result> => {
        try {
          const message = await sendMessage(campaign.orgId, {
            to: r.phone,
            template: {
              name: campaign.templateName,
              language: campaign.language,
              variables: variables.map((v) => cleanParam(v.replaceAll('{name}', r.name || 'there'))),
            },
            idempotencyKey: `campaign:${r.id}`,
          });
          return message.status === 'FAILED'
            ? { id: r.id, status: 'FAILED', messageId: message.id, error: message.errorMessage ?? 'Failed' }
            : { id: r.id, status: 'SENT', messageId: message.id };
        } catch (err) {
          if (err instanceof ApiError && err.code === 'insufficient_balance') return { id: r.id, pause: err.message };
          return { id: r.id, status: 'FAILED', error: err instanceof Error ? err.message : String(err) };
        }
      }),
    );

    let sent = 0;
    let failed = 0;
    for (const result of results) {
      if ('pause' in result) continue;
      // Guarded on PENDING so an overlapping run (cron + after()) can't count a recipient twice.
      const { count } = await prisma.campaignRecipient.updateMany({
        where: { id: result.id, status: 'PENDING' },
        data: { status: result.status, messageId: result.messageId, error: result.error },
      });
      if (count && result.status === 'SENT') sent++;
      else if (count) failed++;
    }
    const pause = results.find((r) => 'pause' in r);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        sent: { increment: sent },
        failed: { increment: failed },
        ...(pause && 'pause' in pause ? { status: 'PAUSED', error: pause.pause } : {}),
      },
    });
    if (pause) return;
  }
}

export async function resumeCampaigns(deadline = Date.now() + 50_000) {
  const campaigns = await prisma.campaign.findMany({ where: { status: 'SENDING' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  for (const { id } of campaigns) {
    if (Date.now() >= deadline) break;
    await processCampaign(id, deadline);
  }
}
