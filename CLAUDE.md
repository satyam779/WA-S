# Notes for Claude

- Setup and architecture: README.md. Long-term plan (Tech Provider → Tech Partner → Solution Partner): C:\Users\satya\.claude\plans\authentication-otp-login-and-wiggly-scott.md
- Money is integer micros (1 INR = 1,000,000). Never use floats or paise for prices; Meta rates have 4 decimals.
- Wallet changes go through `apps/web/src/lib/wallet.ts` (row lock + pure functions from `@wa/billing`). Settlement must stay idempotent: duplicate webhooks are normal.
- Internal packages export TypeScript source (no build step) and use extensionless relative imports.
- Never store OTP codes or template variables in plain text; `Message.body` is only for free-form text.
- Routes: public site `app/(site)`, auth `app/(auth)`, customer app `app/dashboard`. Keep dashboard copy plain and short; customers are business owners, not developers.
- New tables: add `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;` to the migration (Supabase Data API exposure). Production deploys run migrate + seed (apps/web/vercel.json).
- Plans: `apps/web/src/lib/plans.ts`. Store webhooks and COD replies: `apps/web/src/lib/store.ts`. Scheduled work: `/api/cron/tick`.
- DB is Supabase. Create migrations with `prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --script` into a new migrations folder, add RLS lines, then `pnpm --filter @wa/db run migrate:apply`.
- Windows: stop `next dev` before `prisma migrate`/`generate`. The running server locks the engine DLL (EPERM, half-generated client) and keeps the old client in memory.
