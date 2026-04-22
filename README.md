# Quotr

Free quote calculator + paid close-out feedback loop for US tradespeople.

Live: https://quotr.vercel.app

## Stack

- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- Supabase (Auth magic link + Postgres + RLS; new `sb_publishable_`/`sb_secret_` key format)
- Stripe one-time Checkout (no subscriptions)

## Local setup

1. `npm install`
2. `cp .env.example .env.local` and fill in real values
3. Run `schema.sql` in the Supabase SQL Editor (one time)
4. `npm run dev` → http://localhost:3000

## Env vars

See `.env.example` for the full list. Secret keys (`SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) must NEVER be committed or pasted in chat — set them directly in Vercel and your local `.env.local` only.

## Structure

```
app/
  layout.tsx        root layout
  page.tsx          landing page (hero, calculator, pricing, FAQ)
  globals.css       Tailwind + custom utility classes
components/
  Calculator.tsx    free quote calculator (no auth)
lib/
  supabase/
    client.ts       browser client (publishable key)
    server.ts       server client + service-role client
    middleware.ts   session refresh
  utils/
    money.ts        cents ↔ dollars, formatUSD, formatPct
middleware.ts       invokes supabase session refresh on every route
schema.sql          Postgres schema + RLS policies + triggers (run once)
```

## Monetization

Credit packs, not subscription:

- Starter: $29 for 10 close-outs
- Pro: $79 for 40 close-outs
- First close-out free (1 credit granted on signup)

The credit system uses an append-only `credits_ledger` as source of truth and a denormalized `users.credits_balance` for fast reads. Every Stripe webhook insert is idempotent on `stripe_payment_intent_id`.

## Deploy

Push to GitHub. Vercel auto-deploys. Env vars must be set in the Vercel project before the first build succeeds.
