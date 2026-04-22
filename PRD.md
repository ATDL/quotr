# Quotr — Product Requirements Document (v1)

**Status:** Approved for build as of 2026-04-20
**Owner:** Alberto
**Target ship date:** 2 weeks from kickoff (~2026-05-04)
**Monetization:** Credit packs — $29 for 10 close-outs, $79 for 40 close-outs. First close-out free as a taste. No subscription in v1. BidCalc absorbed into Quotr (single product).

---

## 1. Problem Statement

US residential tradespeople — solo operators and 1-5 person shops in HVAC, electrical, plumbing, handyman, and general contracting — price jobs by gut feel and have no feedback loop to know whether they were right. They systematically under-estimate hours and materials, cannot compare profit across job types, and end up running a business on folklore instead of data. The pain is validated across Reddit: "Eff you price" (46K combined upvotes across r/Construction and r/Electricians), "Insane quote" (1,226 upvotes on r/handyman showing three contractors bidding $160 / $800 / $1,800 on the same job), and the repeated r/Contractor lament that "underbidding never saved us, it buried us."

Today they rely on bookkeeping that shows total cash but not per-job profit; on gut; and on Reddit threads where every commenter prices differently. What's missing is a structured loop: **quote → close out the job → see the variance → adjust the next quote.**

---

## 2. Product Overview

**Quotr** is a web app that (a) generates trade-friendly quotes from a short intake (inheriting BidCalc's existing calculator), (b) lets the user mark a job complete and record what actually happened, (c) shows quoted vs actual and profit per job, and (d) calibrates future quotes from the pattern of past ones.

One-line pitch: *"BidCalc told you what to charge. Quotr tells you whether you were right — and teaches the next quote from the last one."*

---

## 3. Goals

**User goals (outcomes for the tradesperson):**

1. Know, at the end of every job, whether it was profitable and by how much.
2. Spot systematic under-pricing in specific job types before it compounds.
3. Walk into the next quote of a given type with a data-grounded number.

**Business goals (outcomes for the dart):**

4. 50 pack purchases across 40+ unique customers within 90 days of launch — proves the "will they pay" question, the one Stage 1 couldn't answer.
5. $1,500+ total pack revenue by day 90. Hits the "real money" threshold for a dart that continues past the kill criterion.
6. ≥30% of first-pack buyers buy a second pack within 60 days. Proves the workflow becomes habitual, not a novelty purchase — this is the credit-pack equivalent of low churn.

---

## 4. Non-Goals (explicitly out of scope for v1)

1. **Full field-service management.** We're not ServiceTitan, Jobber, or Housecall Pro. We don't do scheduling, dispatch, or routing. Rationale: scope explosion; crowded market.
2. **Accounting integrations.** No QuickBooks / Xero / Wave sync in v1. Rationale: API work eats a week and manual entry is acceptable for the 5-10 jobs per month a small shop closes.
3. **Invoicing and collections.** That's Rank 2 (Chase-Free), a separate dart. Rationale: different pain, different product.
4. **Multi-user / team accounts.** v1 is single-user. Rationale: target customer is 1-5 person shops where the owner is the only user who needs close-out data.
5. **Native mobile app.** Web-responsive only. Rationale: tradespeople do close-outs in the truck or at home — a mobile web page is fine; a native app is months of work.
6. **Photo receipts / file uploads.** Rationale: nice to have, not needed to prove the thesis. Parked for P1 or later.

---

## 5. Target Users

**Primary:** US-based residential trade business owners, 1-5 employees, doing 5-30 jobs per month, currently quoting by gut. Evidence base comes from r/Contractor, r/handyman, r/HVAC.

**Secondary (edge):** small commercial subs dealing with GCs (net-90 cash-flow pain). They can use Quotr but the Chase-Free dart will serve them better.

**Not target:** enterprise shops with in-house accounting; marketplace apps (Angi, Thumbtack); franchises.

---

## 6. User Stories

### Onboarding

- As a **new visitor** who just landed on the site from a Google search, I want to understand in under 10 seconds what Quotr does and why it's different from BidCalc, so I can decide whether to try it.
- As a **new user**, I want to sign up with just my email, so I don't have to remember a password.
- As a **returning user**, I want to click a magic link in my inbox and be logged in, so my session is frictionless.

### Creating a quote (BidCalc flow, now persisted)

- As a **logged-in user**, I want my BidCalc quote to auto-save to my account, so I don't have to re-enter data after closing the tab.
- As a **logged-in user**, I want to see my draft quotes before I mark them complete, so I can reference the original estimate during the job.

### Closing out a job (the core new workflow)

- As a **user with a completed job**, I want to open that job's quote and mark it "complete," so I can record what actually happened.
- As a **user recording a close-out**, I want to enter actual hours worked, actual materials cost, and a one-line note on what surprised me, so the data reflects reality.
- As a **user**, I want to tag each close-out with a freeform job type (e.g., "kitchen remodel," "AC install," "drywall repair"), so I can segment later.
- As a **user**, I want the close-out screen to immediately show me: quoted total, actual total, profit dollars, profit percent, variance percent — so I get feedback on this job right now, not later.

### Seeing history

- As a **user**, I want a "My Jobs" list showing my last 10 closed jobs with title, date, job type, and profit %, so I can spot patterns at a glance.
- As a **user who's closed out at least 3 jobs of the same type**, I want to see the average profit % for that type on my jobs list, so I know what's actually profitable.

### Billing

- As a **user who's closed out their first job**, I want to see a paywall that makes the value clear ("keep this data, close out more jobs, see profit trends for $19/month"), so I can decide.
- As a **paying user**, I want to manage my subscription (cancel, update card) without emailing support.

### P1 (week 3-4, not shipping in v1)

- As a **user with 5+ jobs of the same type**, I want a calibration suggestion ("Your kitchen remodels run 18% over quote — add 15% buffer to your next one"), so future quotes improve automatically.
- As a **user**, I want a simple dashboard showing best and worst job types by margin, so I can decide what to say yes to.

---

## 7. Requirements

### P0 — Must-Have (v1 launch)

| # | Requirement | Notes |
|---|---|---|
| P0-1 | Email-based magic-link auth via Supabase Auth | No password. Uses default Supabase email provider for v1; custom sender later. |
| P0-2 | Persist BidCalc quote data per user | Migrate existing BidCalc calculator logic into Quotr repo; save `quote` record to Postgres. |
| P0-3 | Close-Out form: actual_hours, actual_materials_cost, surprise_note, job_type_tag | Single form, single submit. |
| P0-4 | Per-job P&L output | Quoted total, actual total, profit $, profit %, variance %. Shown immediately on close-out. |
| P0-5 | "My Jobs" list — last 10 closed jobs | Table: date, job type, quoted, actual, profit %. |
| P0-6 | Freeform job type tagging | Text input with autocomplete from user's prior tags. No curated list in v1. |
| P0-7 | Stripe one-time Checkout — credit packs ($29 / 10 close-outs, $79 / 40 close-outs) | No subscription. On success, user lands back on the page they were blocked on with a fresh balance. |
| P0-8 | Paywall policy: first close-out free, subsequent close-outs consume one credit. Zero balance triggers pack-purchase modal. | One free taste of the feedback loop, then pay-per-use on the valuable layer. |
| P0-9 | Cold-traffic landing page | Hero, 3-pain explainer, pricing, CTA. No video for v1. |
| P0-10 | Basic analytics (Plausible) | Events: landing view, signup, first quote, first close-out, paywall view, subscription start, cancellation. |

### P1 — Fast Follow (week 3-4)

| # | Requirement | Notes |
|---|---|---|
| P1-1 | Calibration suggestion per job type (after 5+ jobs) | Simple linear average; no ML. |
| P1-2 | Profit-by-type dashboard | One page, three cards: best type, worst type, average. |
| P1-3 | Onboarding email drip (3 emails) | "Welcome + close out your first job" / "Your first profit % + what it means" / "Pro tip + upsell." |
| P1-4 | Job type autocomplete tightened — merge near-duplicates ("HVAC Install" vs "hvac install") | UX polish. |

### P2 — Future Considerations (parked, design-friendly but not built)

- QuickBooks / Wave / Xero integration
- Photo receipt upload
- Team / multi-user accounts
- Native mobile app
- CSV export
- Time-tracking integration (Harvest, Toggl)
- Automatic quote-to-close-out matching from SMS or email
- White-label / brandable version for small franchises

---

## 8. Acceptance Criteria (P0 highlights)

**Magic-link auth (P0-1):**

- Given a new visitor enters their email on /signup
- When they click the magic link in their inbox within 60 minutes
- Then they are logged in and redirected to their dashboard
- And a `user` row exists in Supabase `auth.users`
- And failed / expired links show a clear error with a "resend link" button

**Close-Out form (P0-3, P0-4):**

- Given a user has a saved quote
- When they click "Close out this job" and enter actual_hours, actual_materials_cost, and optionally a note and a job_type
- Then the system computes: profit_dollars = actual_revenue − (actual_hours × hourly_rate + actual_materials_cost), profit_percent = profit_dollars / actual_revenue × 100, variance_percent = (actual_cost − quoted_cost) / quoted_cost × 100
- And displays all three on the close-out result page within 500ms
- And the close-out is persisted and appears in "My Jobs"

**Paywall (P0-7, P0-8):**

- Given a free user attempting to close out their second job
- When they click "Close out this job"
- Then they see a paywall modal explaining the value and a Stripe Checkout button
- And clicking the button opens Stripe Checkout pre-filled with $19/month
- And on successful payment they are redirected back to the close-out form they were blocked on
- And their subscription status is `active` in Supabase

**Landing page (P0-9):**

- Given a cold visitor lands on /
- Then above the fold they see: headline, one-sentence explainer, 3 social proof quotes (from Reddit-validated pain points), CTA "Try free"
- And total page weight is under 300KB
- And Lighthouse score is ≥ 90 on mobile

---

## 9. Success Metrics

**Leading indicators (track from week 1):**

- Signup rate from landing page visit: target ≥ 8%
- Activation: signup → first close-out within 14 days: target ≥ 30%
- Paywall → first pack purchase: target ≥ 20% (cold-traffic crowd; warm users from DM outreach should land higher)
- Repeat pack rate: % of pack buyers who purchase a second pack within 60 days: target ≥ 30%

**Lagging indicators (evaluate at day 30, 60, 90):**

- Day 30: 10 unique pack buyers = signal continues. <5 = kill or pivot.
- Day 60: 25 unique pack buyers, at least 5 of whom bought a repeat pack.
- Day 90: 40+ unique pack buyers, 50+ total pack purchases, $1,500+ revenue.

**Kill criteria (the dart-portfolio rule):**

- If by **day 14 post-launch** we have <20 signups → re-examine messaging, not necessarily kill yet.
- If by **day 30 post-launch** we have 0 pack purchases → kill and move to Rank 2.
- If by **day 60** we have <5 pack purchases, or zero repeat-pack buyers → kill and move to Rank 2.

---

## 10. Technical Architecture (high-level)

- **Frontend:** Next.js 14 (App Router), Tailwind. Deployed on Vercel at `quotr.vercel.app` (or fallback subdomain if taken within Vercel's namespace). Custom domain purchase deferred until Day 30 signal check. Reuses BidCalc's visual language but in a new repo (`ATDL/quotr`).
- **Auth + DB:** Supabase. Magic-link auth; Postgres with row-level security; RLS policies ensure users only see their own quotes and close-outs.
- **Billing:** Stripe Checkout + Customer Portal. Webhook on `customer.subscription.*` events writes status to Supabase `subscriptions` table.
- **Email:** Supabase default for magic links in v1; swap to Resend or Postmark before scaling.
- **Analytics:** Plausible (privacy-respecting, self-contained; avoids Google cookie banner headache).
- **Data model (first pass):**
  - `users` (Supabase auth) — with denormalized `credits_balance` column for fast read
  - `quotes` (id, user_id, customer_name, scope, quoted_hours, quoted_materials, hourly_rate, quoted_total, created_at, status)
  - `close_outs` (id, quote_id, user_id, actual_hours, actual_materials_cost, surprise_note, job_type, computed_profit_cents, computed_profit_pct, computed_variance_pct, credits_spent, created_at)
  - `job_types` (user_id, name, normalized_name) — for autocomplete; populated lazily from close-out entries
  - `credits_ledger` (id, user_id, delta, reason, related_id, stripe_payment_intent_id, created_at) — append-only. Positive delta = pack purchase or initial grant; negative = close-out spend. Source of truth.
  - `pack_purchases` (id, user_id, pack_size, amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, completed_at) — audit trail for Stripe reconciliation.

---

## 11. Open Questions

1. **Domain.** Deferred. v1 ships on `quotr.vercel.app` (or Vercel fallback subdomain if taken). Re-evaluate at Day 30 signal check — if ≥20 paying users, buy helloquotr.com ($11.25). Otherwise stay on the subdomain or kill the dart.
2. **Cold traffic channel for week 2 launch.** Options: Reddit organic (r/Contractor, r/handyman), Indie Hackers, Hacker News "Show HN", small Reddit ad budget ($100), or Facebook group seeding. My recommendation: Reddit organic + Indie Hackers as the free plays, $100 Reddit ad as a paid probe. **Owner:** Alberto decides before day 12.
3. **BidCalc brand continuity.** Does Quotr absorb BidCalc entirely (redirect bidcalc.xxx → quotr.xxx), or do they coexist as separate funnels? **Recommendation:** keep BidCalc as a funnel-top free tool that upgrades into Quotr. **Owner:** Alberto.
4. **Pack sizes and prices.** v1 ships with $29 / 10 close-outs and $79 / 40 close-outs. Should we add a third tier ($149 / 100) on day 1 or wait for signal? **Recommendation:** two tiers only at launch. Add a larger tier if any user burns through a 40-pack.
5. **Job type autocomplete seed list.** v1 is freeform. Should we pre-seed with 10-15 common trade types to reduce typing? **Recommendation:** yes, but only *suggested* alongside free entry. 15 min of work.

---

## 12. Timeline — Two-Week Sprint Plan

### Week 1 — foundation + core workflow

| Day | Milestone |
|---|---|
| 1 | Vercel subdomain reserved (quotr.vercel.app). Supabase project created. Tables defined (quotes, close_outs, job_types, subscriptions). Magic-link auth configured. |
| 2 | Next.js app scaffolded in ATDL/quotr. Supabase client wired. First deployment to Vercel (placeholder landing). |
| 3 | Existing BidCalc calculator logic ported into Quotr. "Save this quote" wired for logged-in users. |
| 4 | Close-Out form complete: actual_hours, actual_materials, surprise_note, job_type input. Submit writes to DB. |
| 5 | Per-job P&L output page. Quoted vs actual vs profit. Analytics events fired. |
| 6 | "My Jobs" list page. Last 10 closed jobs with stats. |
| 7 | Buffer: bug fixing, polish, mobile-responsive sweep. End-of-week demo to Alberto. |

### Week 2 — billing, landing, launch

| Day | Milestone |
|---|---|
| 8 | Stripe account set up. One-time Checkout integration for $29 and $79 packs. Webhook receiving `checkout.session.completed` events → writes `credits_ledger` row. |
| 9 | Credits system complete: balance display, spend-on-close-out logic, paywall modal when balance = 0, pack-purchase flow. |
| 10 | Cold-traffic landing page (hero, 3 pains, pricing, FAQ, CTA). |
| 11 | SEO basics (title, meta, OG image, sitemap, robots.txt). Plausible tracking verified. |
| 12 | Onboarding email (single "welcome + try close-out" email; drip comes in P1). |
| 13 | QA sweep. Friend-of-Alberto tests full flow. Bug fix. Launch checklist signed off. |
| 14 | **Launch day:** post on r/Contractor ("I built a thing — would love feedback"), Indie Hackers, Hacker News Show HN. $50 Reddit ad spend (Alberto-approved budget) to seed cold traffic. |

### Week 3-4 — P1 / evaluate

Driven by post-launch signal. If day 14 looks promising (≥20 signups, ≥3 paid conversions), build P1-1 (calibration) and P1-2 (dashboard). If signal is thin, pause the build and rerun messaging.

---

## 13. Immediate Next Actions (this session)

1. Create Supabase project and grab keys (Alberto-side, ~5 min).
2. Create `ATDL/quotr` GitHub repo (Alberto-side, ~2 min).
3. Scaffold Next.js 14 app with Supabase client, deploy placeholder to Vercel at `quotr.vercel.app`.
4. Draft Supabase schema DDL + initial landing page copy (can happen in parallel while Alberto sets up accounts).

Domain purchase deferred to Day 30 signal check. $50 Reddit ad budget confirmed for launch day.
