import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/utils/money";
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
      "id, customer_name, scope, quoted_hours, quoted_materials_cents, hourly_rate_cents, quoted_total_cents, status"
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

    redirect("/dashboard");
  }

  return (
    <CloseOutForm
      quote={quote}
      credits={credits}
      submitCloseOut={submitCloseOut}
    />
  );
}
