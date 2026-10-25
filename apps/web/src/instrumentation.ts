/** Runs once per server start: reports configuration problems in the logs before customers run into them. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const env = process.env;
  const onVercel = Boolean(env.VERCEL);
  const problems: string[] = [];
  const notes: string[] = [];
  const need = (name: string, why: string) => !env[name] && problems.push(`${name} is missing (${why})`);
  const want = (name: string, effect: string) => !env[name] && notes.push(`${name} not set: ${effect}`);

  need('DATABASE_URL', 'database');
  need('DIRECT_URL', 'database migrations');
  need('META_APP_ID', 'WhatsApp connect');
  need('META_APP_SECRET', 'Meta webhook signatures');
  need('META_WEBHOOK_VERIFY_TOKEN', 'Meta webhook setup');
  need('TOKEN_ENCRYPTION_KEY', 'stored secrets');
  need('OTP_HASH_SECRET', 'OTP codes');
  if (env.TOKEN_ENCRYPTION_KEY && Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64').length !== 32) {
    problems.push('TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded');
  }
  if (onVercel) {
    need('CRON_SECRET', 'background job');
    if (env.META_GRAPH_BASE_URL) problems.push('META_GRAPH_BASE_URL is set, so messages go to a test server instead of Meta. Remove it.');
    if (env.DATABASE_URL?.includes(':5432/')) {
      problems.push('DATABASE_URL uses the session pooler (port 5432). On Vercel use the transaction pooler (6543, ?pgbouncer=true).');
    }
    want('APP_URL', 'links use the Vercel production domain');
  }
  want('META_ES_CONFIG_ID', 'the Connect WhatsApp popup is off');
  want('META_SYSTEM_USER_TOKEN', 'connecting with IDs is off');
  want('RAZORPAY_KEY_ID', 'online recharge is off');
  if (env.RAZORPAY_KEY_ID) want('RAZORPAY_WEBHOOK_SECRET', 'payments are credited only if the buyer returns to the page');
  want('RESEND_API_KEY', 'password reset emails are only written to the log');
  want('SUPPORT_EMAIL', 'the website shows support@example.com');

  if (problems.length) console.error(`[config] Fix these:\n- ${problems.join('\n- ')}`);
  if (notes.length) console.warn(`[config] Optional:\n- ${notes.join('\n- ')}`);
}
