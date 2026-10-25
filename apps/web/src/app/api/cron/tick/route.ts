import { resumeCampaigns } from '@/lib/campaigns';
import { renewPlans } from '@/lib/plans';
import { sendDueCartReminders } from '@/lib/store';

export const maxDuration = 60;

/**
 * Background work: campaigns, cart reminders, plan renewals. Vercel Cron (vercel.json) or any
 * scheduler such as cron-job.org calls it with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  await renewPlans();
  await sendDueCartReminders();
  await resumeCampaigns(Date.now() + 45_000);
  return new Response('OK');
}
