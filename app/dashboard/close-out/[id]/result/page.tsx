import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPct, formatUSD } from "@/lib/utils/money";

export default async function CloseOutResultPage({
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
      "customer_name, scope, quoted_hours, quoted_materials_cents, hourly_rate_cents, quoted_total_cents"
    )
    .eq("id", params.id)
    .single();

  const { data: closeOut } = await supabase
    .from("close_outs")
    .select(
      "actual_hours, actual_materials_cents, surprise_note, job_type, computed_profit_cents, computed_profit_pct, computed_variance_pct"
    )
    .eq("quote_id", params.id)
    .single();

  if (!quote || !closeOut) notFound();

  const actualTotalCents =
    Math.round(closeOut.actual_hours * quote.hourly_rate_cents) +
    closeOut.actual_materials_cents;

  const hoursDiff = closeOut.actual_hours - quote.quoted_hours;
  const materialsDiff =
    closeOut.actual_materials_cents - quote.quoted_materials_cents;

  const profitGood = closeOut.computed_profit_cents >= 0;
  const variance = closeOut.computed_variance_pct;
  const headline = profitGood ? "Profit" : "Loss";

  // Insight copy — the teachable moment that drives behavior change.
  const insight =
    variance > 10
      ? {
          tone: "warn" as const,
          icon: "⚠",
          title: `Over quote by ${formatPct(variance)}.`,
          body: "This is the pattern that buries margin. Consider padding future jobs of this type — or closing out a few more to confirm it's a trend.",
        }
      : variance > 5
      ? {
          tone: "warn" as const,
          icon: "ⓘ",
          title: `Ran ${formatPct(variance)} over quote.`,
          body: "Slightly over. Watch for it on the next job of this type.",
        }
      : variance >= -5
      ? {
          tone: "good" as const,
          icon: "✓",
          title: "Right on quote.",
          body: "Solid estimate — your gut got this one accurate.",
        }
      : {
          tone: "good" as const,
          icon: "✓",
          title: `Under quote by ${formatPct(Math.abs(variance))}.`,
          body: "Good margin. Worth remembering what made this job efficient.",
        };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <a
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-fog hover:text-chalk"
      >
        <span aria-hidden>←</span> Back to My jobs
      </a>

      <header>
        <div className="text-xs uppercase tracking-wider text-moss">
          Job closed
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {quote.customer_name || "Unnamed customer"}
        </h1>
        <p className="mt-1 text-sm text-fog">
          {quote.scope || closeOut.job_type || "No scope"}
        </p>
      </header>

      {/* The payoff: big profit number */}
      <div
        className={`rounded-xl border p-6 text-center ${
          profitGood
            ? "border-moss/30 bg-moss/5"
            : "border-rust/40 bg-rust/5"
        }`}
      >
        <div
          className={`font-mono text-5xl font-bold ${
            profitGood ? "text-moss" : "text-rust"
          }`}
        >
          {profitGood ? "+" : ""}
          {formatUSD(closeOut.computed_profit_cents)}
        </div>
        <div className="mt-1 text-sm uppercase tracking-wider text-fog">
          {headline}
        </div>
        <div
          className={`mt-4 font-mono text-lg ${
            profitGood ? "text-moss" : "text-rust"
          }`}
        >
          {formatPct(closeOut.computed_profit_pct)} margin
        </div>
      </div>

      {/* Quoted → Actual ledger */}
      <div className="rounded-lg border border-white/10 bg-steel p-5">
        <div className="mb-3 text-[11px] uppercase tracking-wider text-fog">
          Quoted vs. actual
        </div>

        <CompareRow
          label="Total"
          quoted={formatUSD(quote.quoted_total_cents)}
          actual={formatUSD(actualTotalCents)}
          delta={
            variance > 0
              ? `+${formatPct(variance)}`
              : variance < 0
              ? `${formatPct(variance)}`
              : "on quote"
          }
          deltaTone={variance > 5 ? "bad" : variance < -5 ? "good" : "neutral"}
          emphasize
        />

        <CompareRow
          label="Hours"
          quoted={String(quote.quoted_hours)}
          actual={String(closeOut.actual_hours)}
          delta={
            Math.abs(hoursDiff) < 0.01
              ? "same"
              : hoursDiff > 0
              ? `+${hoursDiff.toFixed(2)} hrs`
              : `${hoursDiff.toFixed(2)} hrs`
          }
          deltaTone={
            Math.abs(hoursDiff) < 0.5
              ? "neutral"
              : hoursDiff > 0
              ? "bad"
              : "good"
          }
        />

        <CompareRow
          label="Materials"
          quoted={formatUSD(quote.quoted_materials_cents)}
          actual={formatUSD(closeOut.actual_materials_cents)}
          delta={
            Math.abs(materialsDiff) < 100
              ? "same"
              : materialsDiff > 0
              ? `+${formatUSD(materialsDiff)}`
              : formatUSD(materialsDiff)
          }
          deltaTone={
            Math.abs(materialsDiff) < 100
              ? "neutral"
              : materialsDiff > 0
              ? "bad"
              : "good"
          }
        />
      </div>

      {/* The learning moment */}
      <div
        className={`rounded-lg border p-4 ${
          insight.tone === "warn"
            ? "border-safety/30 bg-safety/5"
            : "border-moss/30 bg-moss/5"
        }`}
      >
        <div
          className={`text-sm font-semibold ${
            insight.tone === "warn" ? "text-safety" : "text-moss"
          }`}
        >
          {insight.icon} {insight.title}
        </div>
        <p className="mt-1 text-sm text-fog">{insight.body}</p>
      </div>

      {closeOut.surprise_note && (
        <div className="rounded-lg border border-white/10 bg-steel p-4">
          <div className="text-[11px] uppercase tracking-wider text-fog">
            What surprised you
          </div>
          <p className="mt-2 text-sm italic text-chalk">
            &ldquo;{closeOut.surprise_note}&rdquo;
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <a href="/dashboard" className="btn-ghost flex-1">
          ← My jobs
        </a>
        <a href="/dashboard/new-quote" className="btn-primary flex-1">
          New quote →
        </a>
      </div>
    </div>
  );
}

function CompareRow({
  label,
  quoted,
  actual,
  delta,
  deltaTone,
  emphasize = false,
}: {
  label: string;
  quoted: string;
  actual: string;
  delta: string;
  deltaTone: "good" | "bad" | "neutral";
  emphasize?: boolean;
}) {
  const toneClass =
    deltaTone === "good"
      ? "text-moss"
      : deltaTone === "bad"
      ? "text-rust"
      : "text-fog";
  return (
    <div
      className={`flex items-baseline justify-between py-2 ${
        emphasize ? "border-b border-white/10 pb-3 font-semibold" : ""
      }`}
    >
      <span className="text-sm text-fog">{label}</span>
      <div className="flex items-baseline gap-3 text-sm">
        <span className="font-mono text-fog">{quoted}</span>
        <span className="text-fog">→</span>
        <span className="font-mono">{actual}</span>
        <span className={`w-20 text-right font-mono text-xs ${toneClass}`}>
          {delta}
        </span>
      </div>
    </div>
  );
}
