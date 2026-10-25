import { prisma } from '@wa/db';
import { settleMessage } from './wallet';

const DAY = 86_400_000;

/** Daily housekeeping: keeps tables small and frees money held for messages Meta never reported on. */
export async function cleanUp(now = Date.now()) {
  await prisma.webhookLog.deleteMany({ where: { receivedAt: { lt: new Date(now - 14 * DAY) } } });
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  await prisma.passwordReset.deleteMany({ where: { expiresAt: { lt: new Date(now - DAY) } } });
  await prisma.otpRequest.deleteMany({ where: { createdAt: { lt: new Date(now - 30 * DAY) } } });

  // Meta gives up on undelivered messages after 30 days, so an older hold will never be charged.
  const stale = await prisma.message.findMany({
    where: { reservationStatus: 'HELD', createdAt: { lt: new Date(now - 31 * DAY) } },
    select: { id: true },
    take: 500,
  });
  for (const { id } of stale) await settleMessage(id, { kind: 'release' });
}
