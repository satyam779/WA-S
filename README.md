# WA Platform

WhatsApp messaging for businesses on Meta's Cloud API (Tech Provider stage). A business connects its number with Meta's Embedded Signup popup (or manually with IDs). We create ready-made templates in its account so it can send:

- OTPs (`/api/v1/otp/send`, `/verify`)
- order updates and reminders (`/api/v1/notify/{use case}`)
- promotions to imported contacts (campaigns in the dashboard)

We charge our fee per delivered message from a prepaid wallet, recharged through Razorpay. Until we're a Solution Partner, Meta bills its own part to the business's card.

## Layout

- `apps/web`: Next.js app.
  - Public website: `app/(site)` — landing page, privacy, terms, refunds.
  - Auth: `app/(auth)` — sign up, log in, password reset.
  - Customer dashboard: `app/dashboard`.
  - Public API: `/api/v1/*`. Meta webhook: `/api/webhooks/meta`.
- `packages/meta`: Graph API client, message builders, webhook parsing and signature check.
- `packages/billing`: money in integer micros, rate lookup, wallet hold / capture / release.
- `packages/db`: Prisma schema, migrations, rate seed.
- `packages/shared`: phone parsing, shared enums.

## Run locally

1. Install dependencies: `pnpm install`.
2. Copy `.env.example` to `.env` and fill it in. The database is Supabase; the next section explains where to get its two connection strings.
3. Create the tables and load prices: `pnpm db:migrate`, then `pnpm db:seed`.
4. Start the app: `pnpm dev`, then open http://localhost:3000.

Other commands:

- Run the tests: `pnpm test`.
- Top up a wallet by hand: `pnpm --filter @wa/web credit you@example.com 500`.
- Without `RESEND_API_KEY`, password reset emails are printed in the dev server's terminal.
- On Windows, stop the dev server before running migrations.

## Meta setup (one time)

1. **Business ID.** Verify your business in Meta Business Manager. Put its business portfolio ID in `META_BUSINESS_ID`.
2. **App.** Create a Meta app (Business type) with the WhatsApp use case. Put its credentials in `META_APP_ID` and `META_APP_SECRET`. Pass Tech Provider App Review for advanced access to `whatsapp_business_management` and `whatsapp_business_messaging`.
3. **System user.** In Business settings → System users:
   1. Add an admin user and assign it the app with full control.
   2. Generate a token that never expires, with `whatsapp_business_management`, `whatsapp_business_messaging` and `business_management`.
   3. Put the user's ID in `META_SYSTEM_USER_ID` and the token in `META_SYSTEM_USER_TOKEN`.
4. **Webhook.** In App Dashboard → WhatsApp → Configuration:
   1. Callback URL: `https://YOUR_DOMAIN/api/webhooks/meta`. Verify token: the value of `META_WEBHOOK_VERIFY_TOKEN`.
   2. Subscribe to `messages`, `message_template_status_update`, `phone_number_quality_update` and `account_update`.
5. **Embedded Signup.** Add **Facebook Login for Business** to the app:
   1. Create a configuration with the **WhatsApp Embedded Signup** variation, and put its ID in `META_ES_CONFIG_ID`.
   2. Turn on **Login with the JavaScript SDK** and add your domain to **Allowed domains**.

   Until App Review approves the app, only people with a role on it can finish signup.

   The dashboard's Connect wizard (`/dashboard/connect`) wraps the popup. Meta serves every popup as Embedded Signup v4 since 15 October 2026 (v2 and v3 are retired), so `extras` can't pre-fill business details. When a customer finishes without picking a number, the wizard lists the account's numbers to choose from.

## Deploy to production: Supabase + Vercel

### 1. Supabase (database)

1. Create a project and save the database password. Keep it in the same region as the Vercel functions (`regions` in `apps/web/vercel.json`). Our project is in Mumbai, so the functions run in Mumbai (`bom1`).
2. Click **Connect → ORMs → Prisma** and copy two connection strings:
   - `DATABASE_URL`: the transaction pooler string (port 6543), ending in `?pgbouncer=true&connection_limit=5`. Use it everywhere, including Vercel.
   - Optional, only in your local `.env`: `DATABASE_URL_LOCAL` = the session pooler string (port 5432) plus `?connection_limit=5`. From far away it's several times faster per query, and Vercel ignores it. Never use the session pooler as Vercel's `DATABASE_URL`: it allows only a few connections, and the live site fails under load.
   - `DIRECT_URL`: the session pooler string (port 5432).

Nothing else is needed in Supabase. Each production deploy applies migrations, which also lock every table against Supabase's public Data API (row level security), and loads prices from `packages/db/prisma/seed.ts`.

### 2. Vercel (app)

1. Push the repo to GitHub. `.env` stays out; it's gitignored.
2. In Vercel, import the repo (**Add New → Project**). Set **Root Directory** to `apps/web`. `apps/web/vercel.json` already sets the build command, the Mumbai region and the cron job.
3. Under **Environment Variables**, add every key from `.env.example` with production values:
   - Database: `DATABASE_URL` and `DIRECT_URL` from Supabase.
   - Site: `APP_URL=https://your-domain`, `NEXT_PUBLIC_BRAND_NAME`, `COMPANY_NAME`, `SUPPORT_EMAIL`.
   - Meta: all `META_*` values. Don't set `META_GRAPH_BASE_URL`; it's for local testing only.
   - Secrets: new random values for `TOKEN_ENCRYPTION_KEY`, `OTP_HASH_SECRET` and `CRON_SECRET`. Never change the first two after launch: stored tokens become unreadable and live OTPs stop verifying.
   - Payments and email: Razorpay **live** keys; `RESEND_API_KEY`, plus `EMAIL_FROM` on a domain verified in Resend.
4. Deploy, then add your domain under **Settings → Domains**.

### 3. After the first deploy

- **Meta webhook:** set the callback URL to `https://your-domain/api/webhooks/meta`.
- **Embedded Signup:** add `your-domain` to the allowed domains.
- **Meta app settings:** Privacy Policy URL `https://your-domain/privacy`, Terms URL `https://your-domain/terms`.
- **Razorpay:** website `https://your-domain`. The privacy, terms and refund pages it asks for already exist.

### Free Supabase plan: stop the 7-day pause

Free projects pause after 7 days without database activity. Two things prevent that:

- **GitHub Action** (`.github/workflows/supabase-keepalive.yml`): touches the database every 2 days, whether or not the app is deployed. After pushing to GitHub, add the repo secrets `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Then open **Actions → Keep Supabase awake → Run workflow** once to test it.
- **The deployed app:** the daily Vercel cron already queries the database. For an extra check, point a free uptime monitor (e.g. UptimeRobot) at `https://your-domain/api/health`.

If a project does pause, restore it from the Supabase dashboard. On the Pro plan ($25/month) projects never pause; move to it once you have paying customers.

### Database changes later

1. Run `pnpm db:migrate` locally and commit the new migration folder.
2. The next production deploy applies it.
3. New tables need `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;` in their migration.

## Pricing

Prices are rows in the `Rate` table, seeded from `packages/db/prisma/seed.ts` (re-applied on every production deploy). The `billingMode` on a `Waba` row picks which rates apply:

- `DIRECT_META`: our platform fee only. Meta bills the business.
- `CREDIT_LINE`: Meta's cost plus our markup. Use this once we're a Solution Partner.

Recharge: customers pay exactly the amount they enter, and all of it goes into the wallet. We don't charge GST (`Payment.gstMicros` stays 0).

Meta's own charges: the Wallet page shows what Meta charged this month, from the Graph API's `pricing_analytics` (cached for 15 minutes; Meta adds 18% GST for Indian accounts). As a Tech Provider we can't read a customer's Meta balance, card or invoices, so customers add funds or a card on Meta's Billing & payments page.

## Plans and online store automations

- **Plans:** defined in `apps/web/src/lib/plans.ts` — Free, and Growth at ₹199/month. Upgrades are paid from the wallet. Renewals run in the background job; if the wallet can't pay, the account drops to Free.
- **What Growth unlocks:** the **Online store** page (`apps/web/src/lib/store.ts`). Shopify and WooCommerce post order webhooks to `/api/integrations/{platform}/{token}`, and we send:
  - an order confirmation, or for cash on delivery a Confirm/Cancel question;
  - shipped and delivered updates.
- **Confirm/Cancel taps:** they update the order. See it under **Online store → Recent orders**, or through the API: `GET /api/v1/orders/{order_id}`.

## Background job

Vercel runs `/api/cron/tick` once a day (`apps/web/vercel.json`), with `Authorization: Bearer $CRON_SECRET`. It renews plans and continues unfinished campaigns. In the 03:00 UTC hour it also cleans up old logs, expired logins and stale holds.

## Go-live checklist

When the app starts, its Vercel logs list any missing or wrong setting (look for `[config]`).

1. **Vercel environment variables:** everything in `.env.example`.
   - `DATABASE_URL` must be the transaction pooler (port 6543).
   - Set `APP_URL`, `COMPANY_NAME` and `SUPPORT_EMAIL`.
   - Leave out `META_GRAPH_BASE_URL`.
   - Scope the database variables to **Production** only, so preview deployments never touch live data.
2. **Meta:**
   - Webhook callback: `https://your-domain/api/webhooks/meta`.
   - Your domain in Embedded Signup's allowed domains.
   - Privacy and Terms URLs in the app settings.
   - Tech Provider App Review.
3. **Razorpay:**
   - Live keys.
   - **Payment capture → Automatic**.
   - A webhook to `https://your-domain/api/webhooks/razorpay` for `order.paid` and `payment.captured`, with its secret in `RAZORPAY_WEBHOOK_SECRET`. This credits payments even when the buyer closes the page before it returns.
4. **Resend:** verify your domain and set `EMAIL_FROM`, so password reset emails arrive.
5. **GitHub:** add the `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` secrets for the keep-alive job.
6. **Before real customers:** Supabase Pro (no pausing, daily backups) and Vercel Pro (required for commercial use).
7. **After each deploy:** sign up, connect WhatsApp, send a test OTP and recharge ₹100. Check that `https://your-domain/api/health` returns `{"ok":true}`.
