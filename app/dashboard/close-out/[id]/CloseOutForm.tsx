"use client";

import { useMemo, useState } from "react";
import { formatPct, formatUSD, toCents } from "@/lib/utils/money";

type Quote = {
  id: string;
  customer_name: string | null;
  scope: string | null;
  watching_for: string | null;
  quoted_hours: number;
  quoted_materials_cents: number;
  hourly_rate_cents: number;
  quoted_total_cents: number;
};

type Mode = "new" | "edit";

type Defaults = {
  actualHours: number;
  actualMaterialsCents: number;
  jobType: string | null;
  surpriseNote: string | null;
  wasWatchingCorrect?: boolean | null;
};

type Props = {
  quote: Quote;
  credits: number;
  mode?: Mode;
  defaults?: Defaults;
  submitAction: (formData: FormData) => Promise<void>;
};

export default function CloseOutForm({
  quote,
  credits,
  mode = "new",
  defaults,
  submitAction,
}: Props) {
  const isEdit = mode === "edit";

  const initialHours =
    defaults?.actualHours !== undefined
      ? String(defaults.actualHours)
      : String(quote.quoted_hours);
  const initialMaterials =
    defaults?.actualMaterialsCents !== undefined
      ? String(defaults.actualMaterialsCents / 100)
      : String(quote.quoted_materials_cents / 100);

  const [actualHours, setActualHours] = useState(initialHours);
  const [actualMaterials, setActualMaterials] = useState(initialMaterials);
  const [wasWatchingCorrect, setWasWatchingCorrect] = useState<boolean | null>(
    defaults?.wasWatchingCorrect ?? null
  );

  const { actualTotalCents, profitCents, profitPct, variancePct } =
    useMemo(() => {
      const h = parseFloat(actualHours) || 0;
      const m = parseFloat(actualMaterials) || 0;
      const laborCents = Math.round(h * quote.hourly_rate_cents);
      const materialsCents = toCents(m);
      const actualTotalCents = laborCents + materialsCents;
      const profitCents = quote.quoted_total_cents - actualTotalCents;
      const profitPct =
        quote.quoted_total_cents > 0
          ? (profitCents / quote.quoted_total_cents) * 100
          : 0;
      const variancePct =
        quote.quoted_total_cents > 0
          ? ((actualTotalCents - quote.quoted_total_cents) /
              quote.quoted_total_cents) *
            100
          : 0;
      return { actualTotalCents, profitCents, profitPct, variancePct };
    }, [actualHours, actualMaterials, quote]);

  // Paywall only applies to new close-outs — editing never debits a credit.
  if (!isEdit && credits < 1) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Close out job</h1>
        </header>
        <div className="card text-center">
          <div className="text-4xl">0</div>
          <h2 className="mt-3 text-lg font-semibold">No credits left</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-fog">
            You&rsquo;ve used your free close-out. Buy a pack to keep the
            feedback loop running — packs never expire.
          </p>
          <a href="/dashboard/credits" className="btn-primary mt-6 inline-flex">
            Buy credits →
          </a>
        </div>
      </div>
    );
  }

  const backHref = isEdit
    ? `/dashboard/close-out/${quote.id}/result`
    : "/dashboard";
  const backLabel = isEdit ? "Back to result" : "Back to My jobs";
  const pageTitle = isEdit ? "Edit close-out" : "Close out job";
  const submitLabel = isEdit ? "Save changes" : "Close out job — use 1 credit";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <a
          href={backHref}
          className="mb-4 inline-flex items-center gap-2 text-sm text-fog hover:text-chalk"
        >
          <span aria-hidden>←</span> {backLabel}
        </a>
        <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
        <p className="mt-1 text-sm text-fog">
          {quote.customer_name || "Unnamed customer"}
          {quote.scope ? ` · ${quote.scope}` : ""}
        </p>
      </header>

      {/* Quoted summary */}
      <div className="rounded-lg border border-white/10 bg-steel p-4 text-sm">
        <div className="mb-2 text-[11px] uppercase tracking-wider text-fog">
          What you quoted
        </div>
        <div className="flex justify-between">
          <span className="text-fog">Hours</span>
          <span className="font-mono">{quote.quoted_hours}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-fog">Materials</span>
          <span className="font-mono">
            {formatUSD(quote.quoted_materials_cents)}
          </span>
        </div>
        <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-semibold">
          <span>Quoted total</span>
          <span className="font-mono">
            {formatUSD(quote.quoted_total_cents)}
          </span>
        </div>
      </div>

      <form action={submitAction} className="space-y-5">
        <input type="hidden" name="quoteId" value={quote.id} />
        <input
          type="hidden"
          name="wasWatchingCorrect"
          value={
            wasWatchingCorrect === null ? "" : String(wasWatchingCorrect)
          }
        />

        {quote.watching_for && (
          <div className="rounded-lg border border-safety/30 bg-safety/5 p-4">
            <div className="text-[11px] uppercase tracking-wider text-fog">
              You said you were watching for
            </div>
            <p className="mt-1 text-sm italic text-chalk">
              &ldquo;{quote.watching_for}&rdquo;
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">Were you right?</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWasWatchingCorrect(true)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    wasWatchingCorrect === true
                      ? "border-moss bg-moss/20 text-chalk"
                      : "border-white/15 text-fog hover:border-white/30"
                  }`}
                  aria-pressed={wasWatchingCorrect === true}
                >
                  Yes, called it
                </button>
                <button
                  type="button"
                  onClick={() => setWasWatchingCorrect(false)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    wasWatchingCorrect === false
                      ? "border-rust bg-rust/20 text-chalk"
                      : "border-white/15 text-fog hover:border-white/30"
                  }`}
                  aria-pressed={wasWatchingCorrect === false}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="actualHours">
            Actual hours worked
          </label>
          <input
            id="actualHours"
            name="actualHours"
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.25"
            value={actualHours}
            onChange={(e) => setActualHours(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="actualMaterials">
            Actual materials cost ($)
          </label>
          <input
            id="actualMaterials"
            name="actualMaterials"
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={actualMaterials}
            onChange={(e) => setActualMaterials(e.target.value)}
            required
          />
          <p className="mt-1 text-[11px] text-fog">
            Total across everything — glue, nails, lumber, etc. Quotr tracks
            the total so your profit math stays clean.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="jobType">
            Job type — optional
          </label>
          <input
            id="jobType"
            name="jobType"
            className="input"
            type="text"
            placeholder="e.g. Breaker panel, Bathroom remodel, HVAC install"
            defaultValue={defaults?.jobType ?? ""}
          />
          <p className="mt-1 text-[11px] text-fog">
            Used to group jobs on your dashboard so you can see profit by type.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="surpriseNote">
            What surprised you? — optional
          </label>
          <textarea
            id="surpriseNote"
            name="surpriseNote"
            className="input min-h-[80px] resize-none"
            placeholder="e.g. Second trip for parts cost 2 extra hours I didn't quote"
            defaultValue={defaults?.surpriseNote ?? ""}
          />
        </div>

        {/* Live P&L preview */}
        <div className="rounded-lg border border-white/10 bg-ink p-5">
          <div className="mb-3 text-[11px] uppercase tracking-wider text-fog">
            Profit preview (live)
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-fog">Quoted total</span>
              <span className="font-mono">
                {formatUSD(quote.quoted_total_cents)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-fog">Actual total</span>
              <span className="font-mono">{formatUSD(actualTotalCents)}</span>
            </div>
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm uppercase tracking-wider text-fog">
                Profit / Loss
              </span>
              <span
                className={`font-mono text-3xl font-bold ${
                  profitCents >= 0 ? "text-moss" : "text-rust"
                }`}
              >
                {formatUSD(profitCents)}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-fog">Margin</span>
              <span
                className={`font-mono ${
                  profitPct >= 0 ? "text-moss" : "text-rust"
                }`}
              >
                {formatPct(profitPct)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fog">Variance from quote</span>
              <span
                className={`font-mono ${
                  variancePct <= 0 ? "text-moss" : "text-rust"
                }`}
              >
                {variancePct > 0 ? "+" : ""}
                {formatPct(variancePct)}
              </span>
            </div>
          </div>
        </div>

        {!isEdit && (
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-steel px-4 py-3 text-sm">
            <span className="text-fog">Credits after close-out</span>
            <span className="font-mono font-semibold">
              {credits - 1} remaining
            </span>
          </div>
        )}

        <button type="submit" className="btn-primary w-full">
          {submitLabel}
        </button>

        {isEdit && (
          <p className="text-center text-[11px] text-fog">
            Editing a close-out doesn&rsquo;t use a new credit. Profit and
            variance are recomputed from your new numbers.
          </p>
        )}
      </form>
    </div>
  );
}
