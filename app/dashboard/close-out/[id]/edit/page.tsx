import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/utils/money";
import CloseOutForm from "../CloseOutForm";

export default async function EditCloseOutPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, customer_name, scope, quoted_hours, quoted_materials_cents, hourly_rate_cents, quoted_total_cents"
    )
    .eq("id", params.id)
    .single();

  const { data: closeOut } = await supabase
    .from("close_outs")
    .select("actual_hours, actual_materials_cents, surprise_note, job_type")
    .eq("quote_id", params.id)
    .single();

  if (!quote || !closeOut) notFound();

  async function updateCloseOut(formData: FormData) {
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

    // Re-fetch quote for authoritative rate + quoted total.
    const { data: q } = await supabase
      .from("quotes")
      .select("hourly_rate_cents, quoted_total_cents")
      .eq("id", quoteId)
      .single();

    if (!q) redirect("/dashboard");

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

    // UPDATE — no new credit debit, no status change (still 'closed').
    // RLS's "close_outs owner all" policy enforces ownership on the UPDATE.
    const { error } = await supabase
      .from("close_outs")
      .update({
        actual_hours: actualHours,
        actual_materials_cents: actualMaterialsCents,
        surprise_note: surpriseNote,
        job_type: jobType,
        computed_profit_cents: profitCents,
        computed_profit_pct: parseFloat(profitPct.toFixed(2)),
        computed_variance_pct: parseFloat(variancePct.toFixed(2)),
      })
      .eq("quote_id", quoteId)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    redirect(`/dashboard/close-out/${quoteId}/result`);
  }

  return (
    <CloseOutForm
      quote={quote}
      credits={0}
      mode="edit"
      defaults={{
        actualHours: closeOut.actual_hours,
        actualMaterialsCents: closeOut.actual_materials_cents,
        jobType: closeOut.job_type,
        surpriseNote: closeOut.surprise_note,
      }}
      submitAction={updateCloseOut}
    />
  );
}
