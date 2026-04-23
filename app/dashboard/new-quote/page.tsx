import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Calculator from "@/components/Calculator";
import { toCents } from "@/lib/utils/money";

async function saveQuote(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const hours = parseFloat(formData.get("hours") as string) || 0;
  const rate = parseFloat(formData.get("rate") as string) || 0;
  const materials = parseFloat(formData.get("materials") as string) || 0;
  const markupPct = parseFloat(formData.get("markupPct") as string) || 0;
  const customerName =
    ((formData.get("customerName") as string) || "").trim() || null;
  const scope = ((formData.get("scope") as string) || "").trim() || null;

  const laborCents = toCents(hours * rate);
  const materialsCents = toCents(materials);
  const subtotal = laborCents + materialsCents;
  const markupCents = Math.round(subtotal * (markupPct / 100));
  const totalCents = subtotal + markupCents;

  await supabase.from("quotes").insert({
    user_id: user.id,
    customer_name: customerName,
    scope,
    quoted_hours: hours,
    quoted_materials_cents: materialsCents,
    hourly_rate_cents: toCents(rate),
    quoted_total_cents: totalCents,
  });

  redirect("/dashboard");
}

export default function NewQuotePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">New quote</h1>
        <p className="mt-1 text-sm text-fog">
          Fill in the numbers, then save to track it and close out later.
        </p>
      </header>
      <Calculator saveAction={saveQuote} />
    </div>
  );
}
