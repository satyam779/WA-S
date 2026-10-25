import { BRAND } from './env';

/** Whether emails really go out. Without it, password reset can't work on the live site. */
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

/** Sends through Resend. Without RESEND_API_KEY (local dev) the email is printed to the server log instead. */
export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] to ${to}: ${subject}\n${html}`);
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? `${BRAND} <onboarding@resend.dev>`, to, subject, html }),
  });
  if (!response.ok) throw new Error(`Email failed: ${response.status} ${await response.text()}`);
}
