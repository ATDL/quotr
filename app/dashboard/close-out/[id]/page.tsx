import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/utils/money";
import { BADGE_ORDER, computeUnlocked } from "@/lib/badges";
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
      "id, customer_name, scope, watching_for, quoted_hours, quoted_materials_cents, hourly_rate_cents, quoted_total_cents, status"
    )
    .eq("id", params.id)
    .single();

  if (!quote || quote.status !== "open") notFound();

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
      .select("id, hourly_rate_cents, quoted_total_cents, status")
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

    const actualMaterialsCents = toCents(actualMaterials);
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
    });

    if (error) throw new Error(error.message);

    // Trigger on_credits_ledger_insert decrements users.credits_balance.
    await supabase.from("credits_ledger").insert({
      user_id: user.id,
      delta: -1,
      reason: "close_out_debit",
      related_id: quoteId,
    });

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
