import { resumeCampaigns } from '@/lib/campaigns';
import { cleanUp } from '@/lib/maintenance';
import { renewPlans } from '@/lib/plans';
import { sendDueCartReminders } from '@/lib/store';

export const maxDuration = 60;

/**
 * Background work: plan renewals, cart reminders, campaigns, and (in the 03:00 UTC hour) housekeeping.
 * Vercel Cron (vercel.json) or a scheduler such as cron-job.org calls it with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  await renewPlans();
  await sendDueCartReminders();
  await resumeCampaigns(Date.now() + 40_000);
  if (new Date().getUTCHours() === 3) await cleanUp();
  return new Response('OK');
}
