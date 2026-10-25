import { unstable_cache } from 'next/cache';
import { prisma } from '@wa/db';
import { graphFor } from './meta';

/**
 * Meta's reasons it won't let this number send right now; empty when it can.
 * The dashboard asks on every visit, so answers are cached for 5 minutes.
 */
export const sendingBlockers = unstable_cache(
  async (phoneNumberId: string) => {
    const phone = await prisma.phoneNumber.findUniqueOrThrow({ where: { id: phoneNumberId }, include: { waba: true } });
    const health = await graphFor(phone.waba).getHealth(phone.metaPhoneNumberId);
    if (health.can_send_message !== 'BLOCKED') return [];
    const reasons = health.entities
      .filter((e) => e.can_send_message === 'BLOCKED')
      .flatMap((e) => e.errors ?? [])
      .map((e) => ({ code: e.error_code, text: [e.error_description, e.possible_solution].filter(Boolean).join(' ') }));
    return reasons.length ? reasons : [{ code: 0, text: 'Open WhatsApp Manager to see why.' }];
  },
  ['sending-blockers'],
  { revalidate: 300 },
);
