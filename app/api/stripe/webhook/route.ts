import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { isPack, PACK_SIZE, stripe, type Pack } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Stripe webhook: credit a user when their Checkout completes.
 *
 * Security:
 *   1. Signature verification is REQUIRED — reject anything else.
 *      (CLAUDE.md global rule.)
 *   2. STRIPE_WEBHOOK_SECRET must be set; we reject 500 if not, rather
 *      than silently accept unsigned payloads.
 *   3. The middleware matcher excludes this path so the raw body
 *      survives intact for HMAC verification.
 *
 * Idempotency:
 *   pack_purchases.stripe_payment_intent_id and credits_ledger's
 *   uq_credits_ledger_stripe_pi index both unique on the same field.
 *   Stripe retries duplicate webhooks; we treat the unique-violation as
 *   "already credited" and return 200 so Stripe stops retrying.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Fail loudly server-side; don't pretend to accept unsigned payloads.
    return new NextResponse(
      "STRIPE_WEBHOOK_SECRET not configured",
      { status: 500 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new NextResponse("Missing stripe-signature header", {
      status: 400,
    });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid signature";
    return new NextResponse(`Webhook signature verification failed: ${msg}`, {
      status: 400,
    });
  }

  // We only care about completed checkouts here. Other events return 200
  // so Stripe stops retrying.
  if (event.type !== "checkout.session.completed") {
    return new NextResponse("ok", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  const userId = session.metadata?.user_id;
  const packRaw = session.metadata?.pack;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!userId || !isPack(packRaw) || !paymentIntentId) {
    return new NextResponse(
      "Missing or invalid metadata on checkout session",
      { status: 400 }
    );
  }

  const pack = packRaw as Pack;
  const packSize = PACK_SIZE[pack];
  const amountCents = session.amount_total ?? 0;

  // Service-role client bypasses RLS — required because the webhook isn't
  // running as the user. We tightly scope what we touch (no SELECTs on PII).
  const supa = createServiceClient();

  // Insert pack_purchases row (audit trail). Unique constraints handle retries.
  const { error: ppErr } = await supa.from("pack_purchases").insert({
    user_id: userId,
    pack_size: packSize,
    amount_cents: amountCents,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
  });

  if (ppErr && ppErr.code !== "23505") {
    return new NextResponse(`pack_purchases: ${ppErr.message}`, {
      status: 500,
    });
  }

  // Insert ledger entry. on_credits_ledger_insert trigger bumps
  // users.credits_balance automatically.
  const { error: ledgerErr } = await supa.from("credits_ledger").insert({
    user_id: userId,
    delta: packSize,
    reason: "pack_purchase",
    stripe_payment_intent_id: paymentIntentId,
  });

  if (ledgerErr && ledgerErr.code !== "23505") {
    return new NextResponse(`credits_ledger: ${ledgerErr.message}`, {
      status: 500,
    });
  }

  return new NextResponse("ok", { status: 200 });
}
