import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/utils/money";
import { BADGE_ORDER, computeUnlocked } from "@/lib/badges";
import { parseActualLines, parseQuoteLines } from "@/lib/materials";
import CloseOutForm from "./CloseOutForm";

export default async function CloseOutPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS ensures this only returns a row the user owns.
  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, customer_name, scope, watching_for, quoted_hours, quoted_materials_cents, hourly_rate_cents, quoted_total_cents, status, materials_itemized, materials_lines, archived_at, deleted_at"
    )
    .eq("id", params.id)
    .single();

  if (!quote || quote.status !== "open" || quote.archived_at || quote.deleted_at) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("users")
    .select("credits_balance")
    .eq("id", user.id)
    .single();

  const credits = profile?.credits_balance ?? 0;

  async function submitCloseOut(formData: FormData) {
    "use server";

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const quoteId = formData.get("quoteId") as string;
    const actualHours = parseFloat(formData.get("actualHours") as string) || 0;
    const actualMaterials =
      parseFloat(formData.get("actualMaterials") as string) || 0;
    const jobType =
      ((formData.get("jobType") as string) || "").trim() || null;
    const surpriseNote =
      ((formData.get("surpriseNote") as string) || "").trim() || null;
    const rawWatching = (formData.get("wasWatchingCorrect") as string) || "";
    const wasWatchingCorrect =
      rawWatching === "true" ? true : rawWatching === "false" ? false : null;

    // Re-fetch for authoritative numbers — never trust client-submitted totals.
    const { data: q } = await supabase
      .from("quotes")
      .select(
        "id, hourly_rate_cents, quoted_total_cents, status, materials_itemized, materials_lines"
      )
      .eq("id", quoteId)
      .single();

    if (!q || q.status !== "open") redirect("/dashboard");

    const { data: p } = await supabase
      .from("users")
      .select("credits_balance")
      .eq("id", user.id)
      .single();

    if ((p?.credits_balance ?? 0) < 1) redirect("/dashboard/credits");

    // Badges: snapshot the user's existing close-outs BEFORE insert so we
    // can diff against the post-insert set to find newly-unlocked badges.
    const { data: priorCloseOuts } = await supabase
      .from("close_outs")
      .select("computed_variance_pct, was_watching_correct")
      .eq("user_id", user.id);
    const priorUnlocked = computeUnlocked(priorCloseOuts ?? []);

    // Itemized actuals — only honored when the source quote was itemized.
    const actualItemized =
      q.materials_itemized &&
      formData.get("actualMaterialsItemized") === "true";
    const actualLines = actualItemized
      ? parseActualLines(formData.get("actualMaterialsLines"))
      : [];

    // When itemized, the cents total IS the sum of line actuals. This keeps
    // the denormalized actual_materials_cents in sync with the lines.
    const actualMaterialsCents = actualItemized
      ? actualLines.reduce((s, l) => s + l.actual_cents, 0)
      : toCents(actualMaterials);
    const actualLaborCents = Math.round(actualHours * q.hourly_rate_cents);
    const actualTotalCents = actualLaborCents + actualMaterialsCents;
    const profitCents = q.quoted_total_cents - actualTotalCents;
    const profitPct =
      q.quoted_total_cents > 0
        ? (profitCents / q.quoted_total_cents) * 100
        : 0;
    const variancePct =
      q.quoted_total_cents > 0
        ? ((actualTotalCents - q.quoted_total_cents) / q.quoted_total_cents) *
          100
        : 0;

    // Trigger on_close_out_created flips quote status to 'closed'.
    const { error } = await supabase.from("close_outs").insert({
      quote_id: quoteId,
      user_id: user.id,
      actual_hours: actualHours,
      actual_materials_cents: actualMaterialsCents,
      surprise_note: surpriseNote,
      job_type: jobType,
      was_watching_correct: wasWatchingCorrect,
      computed_profit_cents: profitCents,
      computed_profit_pct: parseFloat(profitPct.toFixed(2)),
      computed_variance_pct: parseFloat(variancePct.toFixed(2)),
      credits_spent: 1,
      actual_materials_itemized: actualItemized,
      actual_materials_lines: actualLines,
      // Margin-rename: explicit names alongside the computed_* aliases.
      actual_subtotal_cents: actualTotalCents,
      actual_profit_cents: profitCents,
      actual_margin_pct: parseFloat(profitPct.toFixed(2)),
    });

    if (error) throw new Error(error.message);

    // Credits ledger has only a SELECT policy for users — INSERTs MUST go
    // through the service-role client (this is per-design so client code
    // can never grant itself credits). The on_credits_ledger_insert trigger
    // bumps users.credits_balance.
    const ledgerClient = createServiceClient();
    const { error: ledgerErr } = await ledgerClient
      .from("credits_ledger")
      .insert({
        user_id: user.id,
        delta: -1,
        reason: "close_out_debit",
        related_id: quoteId,
      });

    if (ledgerErr) {
      // Loud log so a missed debit shows up in Vercel logs for reconciliation.
      // We don't unwind the close_out — the user did the work, and we'd
      // rather they get a free close-out than lose the data.
      console.error("[close-out] credit debit failed:", {
        userId: user.id,
        quoteId,
        error: ledgerErr.message,
        code: ledgerErr.code,
      });
    }

    // Diff unlocks to find which badges the user just earned.
    const newUnlocked = computeUnlocked([
      ...(priorCloseOuts ?? []),
      {
        computed_variance_pct: parseFloat(variancePct.toFixed(2)),
        was_watching_correct: wasWatchingCorrect,
      },
    ]);
    const newly = BADGE_ORDER.filter(
      (id) => newUnlocked.has(id) && !priorUnlocked.has(id)
    );
    const badgeParam = newly.length > 0 ? `?badge=${newly[0]}` : "";

    // Force the dashboard's cached data to refetch so the credits pill
    // and stats reflect the just-debited balance immediately.
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/credits");

    // Redirect to the result screen — the feedback-loop payoff.
    redirect(`/dashboard/close-out/${quoteId}/result${badgeParam}`);
  }

  return (
    <CloseOutForm
      quote={quote}
      credits={credits}
      submitAction={submitCloseOut}
    />
  );
}
