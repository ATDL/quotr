import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BADGES, isBadgeId } from "@/lib/badges";
import { parseActualLines, parseQuoteLines } from "@/lib/materials";
import RevealScreen from "./RevealScreen";

export default async function CloseOutResultPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { badge?: string; msg?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, customer_name, scope, watching_for, quoted_hours, quoted_materials_cents, hourly_rate_cents, quoted_total_cents, materials_itemized, materials_lines, archived_at, deleted_at"
    )
    .eq("id", params.id)
    .single();

  const { data: closeOut } = await supabase
    .from("close_outs")
    .select(
      "actual_hours, actual_materials_cents, surprise_note, job_type, was_watching_correct, computed_profit_cents, computed_profit_pct, computed_variance_pct, actual_materials_itemized, actual_materials_lines, created_at"
    )
    .eq("quote_id", params.id)
    .single();

  // Instead of a hard 404 (which gives no info), redirect to the dashboard
  // with a diagnostic banner. We also log the cause so it's visible in
  // Vercel function logs when this fires.
  if (!quote || !closeOut || quote.deleted_at) {
    const reason = !quote
      ? "quote_missing"
      : !closeOut
      ? "closeout_missing"
      : "quote_deleted";
    console.error("[result page] cannot render", {
      quoteId: params.id,
      userId: user.id,
      reason,
      quoteFound: !!quote,
      closeOutFound: !!closeOut,
      quoteDeletedAt: quote?.deleted_at ?? null,
    });
    redirect(`/dashboard?msg=result_${reason}`);
  }

  // Undo eligibility: server-side wall-clock against close-out create time
  // plus the user's last_undo_at. The button is hidden, not just disabled,
  // when ineligible — server still re-checks before honoring.
  const closeOutAgeMs = Date.now() - new Date(closeOut.created_at).getTime();
  const within5Min = closeOutAgeMs < 5 * 60 * 1000;

  const { data: undoProfile } = await supabase
    .from("users")
    .select("last_undo_at")
    .eq("id", user.id)
    .single();
  const lastUndoMs = undoProfile?.last_undo_at
    ? Date.now() - new Date(undoProfile.last_undo_at).getTime()
    : Infinity;
  const undoQuotaAvailable = lastUndoMs >= 30 * 24 * 60 * 60 * 1000;

  const canUndo = within5Min && undoQuotaAvailable && !quote.archived_at;
  // The brief uses customer_name as the type-to-confirm token, falling back
  // to the last 4 chars of the quote ID when there's no name.
  const deleteConfirmHint = quote.customer_name?.trim() || quote.id.slice(-4);
  const isArchived = !!quote.archived_at;

  // Derived values computed server-side so the client doesn't re-compute math.
  const quotedLaborCents = Math.round(
    quote.quoted_hours * quote.hourly_rate_cents
  );
  const actualLaborCents = Math.round(
    closeOut.actual_hours * quote.hourly_rate_cents
  );
  const actualTotalCents = actualLaborCents + closeOut.actual_materials_cents;

  // Is this the user's very first close-out? Powers the onboarding flourish.
  const { count } = await supabase
    .from("close_outs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const isFirstCloseOut = (count ?? 0) <= 1;

  // Current credits balance — shown in a stat pill post-reveal.
  const { data: profile } = await supabase
    .from("users")
    .select("credits_balance")
    .eq("id", user.id)
    .single();

  // Optional ?badge=<id> signals a newly unlocked badge on the redirect
  // that came from the close-out action. Validated before it's rendered.
  const badgeParam = searchParams.badge;
  const unlockedBadge =
    badgeParam && isBadgeId(badgeParam) ? BADGES[badgeParam] : null;

  return (
    <RevealScreen
      quoteId={params.id}
      customerName={quote.customer_name}
      scope={quote.scope}
      jobType={closeOut.job_type}
      watchingFor={quote.watching_for}
      wasWatchingCorrect={closeOut.was_watching_correct}
      surpriseNote={closeOut.surprise_note}
      quotedHours={quote.quoted_hours}
      actualHours={closeOut.actual_hours}
      quotedMaterialsCents={quote.quoted_materials_cents}
      actualMaterialsCents={closeOut.actual_materials_cents}
      quotedTotalCents={quote.quoted_total_cents}
      actualTotalCents={actualTotalCents}
      profitCents={closeOut.computed_profit_cents}
      profitPct={closeOut.computed_profit_pct}
      variancePct={closeOut.computed_variance_pct}
      creditsLeft={profile?.credits_balance ?? 0}
      isFirstCloseOut={isFirstCloseOut}
      unlockedBadge={unlockedBadge}
      quotedLaborCents={quotedLaborCents}
      actualLaborCents={actualLaborCents}
      materialsItemized={
        (quote.materials_itemized ?? false) &&
        (closeOut.actual_materials_itemized ?? false)
      }
      quoteLines={parseQuoteLines(quote.materials_lines)}
      actualLines={parseActualLines(closeOut.actual_materials_lines)}
      canUndo={canUndo}
      isArchived={isArchived}
      deleteConfirmHint={deleteConfirmHint}
      msg={searchParams.msg ?? null}
    />
  );
}
