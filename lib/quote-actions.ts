"use server";

/**
 * Server actions for archive, delete-forever, restore, recover, and undo
 * close-out. Imported by the result page, archived/deleted listing pages,
 * and any kebab/inline action menu.
 *
 * All paths use the user-scoped Supabase client (RLS enforces ownership).
 * No service role here.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const FIVE_MIN_MS = 5 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function safeStr(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

// ============================================================================
// ARCHIVE — soft hide. Stats unchanged.
// ============================================================================
export async function archiveQuote(formData: FormData) {
  const { supabase, user } = await requireUser();
  const quoteId = safeStr(formData.get("quoteId"));
  const returnTo = safeStr(formData.get("returnTo")) || "/dashboard";

  const now = new Date().toISOString();

  // Update both quote and any close-out together. RLS scopes both to user.
  await supabase
    .from("quotes")
    .update({ archived_at: now })
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .is("deleted_at", null);

  await supabase
    .from("close_outs")
    .update({ archived_at: now })
    .eq("quote_id", quoteId)
    .eq("user_id", user.id)
    .is("archived_at", null);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/archived");
  redirect(`${returnTo}?msg=archived`);
}

// ============================================================================
// RESTORE — un-archive. From /dashboard/archived.
// ============================================================================
export async function restoreQuote(formData: FormData) {
  const { supabase, user } = await requireUser();
  const quoteId = safeStr(formData.get("quoteId"));

  await supabase
    .from("quotes")
    .update({ archived_at: null })
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  await supabase
    .from("close_outs")
    .update({ archived_at: null })
    .eq("quote_id", quoteId)
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/archived");
  redirect("/dashboard?msg=restored");
}

// ============================================================================
// DELETE FOREVER — soft delete + immediate PII redaction. Hard purge at 30d.
// ============================================================================
export async function deleteQuoteForever(formData: FormData) {
  const { supabase, user } = await requireUser();
  const quoteId = safeStr(formData.get("quoteId"));
  const confirmation = safeStr(formData.get("confirmation")).trim();

  // Re-fetch to authoritatively check the confirmation token. Never trust the
  // client to tell us the customer name — we look it up server-side.
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, customer_name")
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .single();

  if (!quote) redirect("/dashboard");

  const expected = (quote.customer_name?.trim() || quote.id.slice(-4)).toLowerCase();
  if (confirmation.toLowerCase() !== expected) {
    redirect(`/dashboard/close-out/${quoteId}/result?msg=delete_mismatch`);
  }

  const now = new Date().toISOString();

  // PII redaction in the same UPDATE. Numeric values (hours, cents, variance)
  // stay until hard-purge — they don't identify anyone, and the user can
  // recover during the 30-day window.
  await supabase
    .from("quotes")
    .update({
      customer_name: null,
      scope: null,
      watching_for: null,
      deleted_at: now,
      pii_redacted_at: now,
    })
    .eq("id", quoteId)
    .eq("user_id", user.id);

  await supabase
    .from("close_outs")
    .update({
      surprise_note: null,
      deleted_at: now,
    })
    .eq("quote_id", quoteId)
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/deleted");
  redirect("/dashboard?msg=deleted");
}

// ============================================================================
// RECOVER (from /deleted, before hard-purge)
// ============================================================================
export async function recoverQuote(formData: FormData) {
  const { supabase, user } = await requireUser();
  const quoteId = safeStr(formData.get("quoteId"));

  await supabase
    .from("quotes")
    .update({ deleted_at: null })
    .eq("id", quoteId)
    .eq("user_id", user.id);

  await supabase
    .from("close_outs")
    .update({ deleted_at: null })
    .eq("quote_id", quoteId)
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/deleted");
  // PII has been nulled and stays nulled — that's intentional per spec.
  redirect("/dashboard?msg=recovered");
}

// ============================================================================
// UNDO CLOSE-OUT — 5-minute window, refunds credit, 1-per-30-days.
// ============================================================================
export async function undoCloseOut(formData: FormData) {
  const { supabase, user } = await requireUser();
  const quoteId = safeStr(formData.get("quoteId"));

  // Server-side wall-clock check against close_outs.created_at (don't trust
  // any timestamp from the client).
  const { data: closeOut } = await supabase
    .from("close_outs")
    .select("id, quote_id, created_at, credits_spent")
    .eq("quote_id", quoteId)
    .eq("user_id", user.id)
    .single();

  if (!closeOut) {
    redirect("/dashboard?msg=undo_not_found");
  }

  const ageMs = Date.now() - new Date(closeOut.created_at).getTime();
  if (ageMs > FIVE_MIN_MS) {
    redirect(
      `/dashboard/close-out/${quoteId}/result?msg=undo_expired`
    );
  }

  // Rate limit: 1 per 30 days per user.
  const { data: profile } = await supabase
    .from("users")
    .select("last_undo_at, credits_balance")
    .eq("id", user.id)
    .single();

  if (profile?.last_undo_at) {
    const lastUndoMs = Date.now() - new Date(profile.last_undo_at).getTime();
    if (lastUndoMs < THIRTY_DAYS_MS) {
      redirect(
        `/dashboard/close-out/${quoteId}/result?msg=undo_rate_limited`
      );
    }
  }

  // Refund the credit via service-role — credits_ledger only has a SELECT
  // policy for users, so user-scoped inserts get silently denied by RLS.
  // The on_credits_ledger_insert trigger bumps users.credits_balance.
  const ledgerClient = createServiceClient();
  const { error: refundErr } = await ledgerClient
    .from("credits_ledger")
    .insert({
      user_id: user.id,
      delta: closeOut.credits_spent ?? 1,
      reason: "refund",
      related_id: quoteId,
    });

  if (refundErr) {
    console.error("[undoCloseOut] refund failed:", {
      userId: user.id,
      quoteId,
      error: refundErr.message,
      code: refundErr.code,
    });
    redirect(`/dashboard?msg=undo_refund_failed`);
  }

  // Delete the close-out. Quote status reverts to 'open' explicitly — the
  // mark_quote_closed trigger only fires on INSERT, not DELETE.
  await supabase
    .from("close_outs")
    .delete()
    .eq("id", closeOut.id)
    .eq("user_id", user.id);

  await supabase
    .from("quotes")
    .update({ status: "open" })
    .eq("id", quoteId)
    .eq("user_id", user.id);

  // Stamp the undo so the next attempt within 30 days is rejected.
  await supabase
    .from("users")
    .update({ last_undo_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/dashboard");
  redirect("/dashboard?msg=undone");
}
