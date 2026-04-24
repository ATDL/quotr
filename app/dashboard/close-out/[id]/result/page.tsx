import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BADGES, isBadgeId } from "@/lib/badges";
import RevealScreen from "./RevealScreen";

export default async function CloseOutResultPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { badge?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "customer_name, scope, watching_for, quoted_hours, quoted_materials_cents, hourly_rate_cents, quoted_total_cents"
    )
    .eq("id", params.id)
    .single();

  const { data: closeOut } = await supabase
    .from("close_outs")
    .select(
      "actual_hours, actual_materials_cents, surprise_note, job_type, was_watching_correct, computed_profit_cents, computed_profit_pct, computed_variance_pct"
    )
    .eq("quote_id", params.id)
    .single();

  if (!quote || !closeOut) notFound();

  // Derived values computed server-side so the client doesn't re-compute math.
  const actualTotalCents =
    Math.round(closeOut.actual_hours * quote.hourly_rate_cents) +
    closeOut.actual_materials_cents;

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
    />
  );
}
