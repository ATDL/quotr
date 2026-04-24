"use client";

import { useMemo, useState } from "react";
import { formatPct, formatUSD, toCents } from "@/lib/utils/money";
import type { ActualLine, QuoteLine } from "@/lib/materials";

type Quote = {
  id: string;
  customer_name: string | null;
  scope: string | null;
  watching_for: string | null;
  quoted_hours: number;
  quoted_materials_cents: number;
  hourly_rate_cents: number;
  quoted_total_cents: number;
  materials_itemized: boolean;
  materials_lines: QuoteLine[];
};

type Mode = "new" | "edit";

type Defaults = {
  actualHours: number;
  actualMaterialsCents: number;
  jobType: string | null;
  surpriseNote: string | null;
  wasWatchingCorrect?: boolean | null;
  actualMaterialsItemized?: boolean;
  actualMaterialsLines?: ActualLine[];
};

function newLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function seedActualsFromQuote(lines: QuoteLine[]): ActualLine[] {
  return lines
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((l) => ({
      id: l.id,
      name: l.name,
      quoted_cents: l.cost_cents,
      actual_cents: l.cost_cents, // pre-fill with quoted; user edits the ones that differ
    }));
}

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

  // Itemized actuals — default: mirror the quote's itemization state.
  const [actualItemized, setActualItemized] = useState<boolean>(
    defaults?.actualMaterialsItemized ?? quote.materials_itemized
  );
  const [actualLines, setActualLines] = useState<ActualLine[]>(
    defaults?.actualMaterialsLines &&
      defaults.actualMaterialsLines.length > 0
      ? defaults.actualMaterialsLines
      : quote.materials_itemized
      ? seedActualsFromQuote(quote.materials_lines ?? [])
      : []
  );

  const { actualTotalCents, profitCents, profitPct, variancePct } =
    useMemo(() => {
      const h = parseFloat(actualHours) || 0;
      const laborCents = Math.round(h * quote.hourly_rate_cents);
      const materialsCents = actualItemized
        ? actualLines.reduce((s, l) => s + l.actual_cents, 0)
        : toCents(parseFloat(actualMaterials) || 0);
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
    }, [actualHours, actualMaterials, actualItemized, actualLines, quote]);

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

        {actualItemized ? (
          <ActualMaterialsField
            lines={actualLines}
            onLinesChange={setActualLines}
            onCollapse={() => {
              // Collapse to single-input: preserve the summed dollar amount.
              const sumCents = actualLines.reduce(
                (s, l) => s + l.actual_cents,
                0
              );
              setActualMaterials(sumCents > 0 ? String(sumCents / 100) : "");
              setActualLines([]);
              setActualItemized(false);
            }}
          />
        ) : (
          <div>
            <label
              className="label flex items-center justify-between gap-3"
              htmlFor="actualMaterials"
            >
              <span>Actual materials cost ($)</span>
              {quote.materials_itemized && (
                <button
                  type="button"
                  onClick={() => {
                    setActualItemized(true);
                    if (actualLines.length === 0) {
                      setActualLines(
                        seedActualsFromQuote(quote.materials_lines ?? [])
                      );
                    }
                  }}
                  className="text-[10px] normal-case tracking-normal text-fog underline-offset-2 hover:text-chalk hover:underline"
                >
                  + Itemize actuals
                </button>
              )}
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
        )}

        <input
          type="hidden"
          name="actualMaterialsItemized"
          value={actualItemized ? "true" : "false"}
        />
        <input
          type="hidden"
          name="actualMaterialsLines"
          value={JSON.stringify(actualLines)}
        />

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

function ActualMaterialsField({
  lines,
  onLinesChange,
  onCollapse,
}: {
  lines: ActualLine[];
  onLinesChange: (lines: ActualLine[]) => void;
  onCollapse: () => void;
}) {
  const allSameAsQuoted = lines.every(
    (l) => l.actual_cents === l.quoted_cents
  );

  function sameAsAll() {
    onLinesChange(
      lines.map((l) => ({ ...l, actual_cents: l.quoted_cents }))
    );
  }

  function updateLine(idx: number, patch: Partial<ActualLine>) {
    onLinesChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addSurpriseLine() {
    onLinesChange([
      ...lines,
      {
        id: newLineId(),
        name: "",
        quoted_cents: 0,
        actual_cents: 0,
        new_at_closeout: true,
      },
    ]);
  }

  function removeLine(idx: number) {
    onLinesChange(lines.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="label mb-0">Actual materials</span>
        <button
          type="button"
          onClick={onCollapse}
          className="text-[10px] normal-case tracking-normal text-fog underline-offset-2 hover:text-chalk hover:underline"
        >
          Report as one total
        </button>
      </div>

      <button
        type="button"
        onClick={sameAsAll}
        disabled={allSameAsQuoted || lines.length === 0}
        className="btn-ghost mb-3 w-full text-sm"
      >
        {allSameAsQuoted
          ? "✓ All actuals match quote"
          : "Same as quoted for all materials"}
      </button>

      <ul className="space-y-2" role="list">
        {lines.map((line, i) => {
          const matches = line.actual_cents === line.quoted_cents;
          const diff = line.actual_cents - line.quoted_cents;
          return (
            <li
              key={line.id}
              className={`rounded-lg border p-3 ${
                line.new_at_closeout
                  ? "border-safety/30 bg-safety/5"
                  : "border-white/10 bg-ink"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {line.new_at_closeout ? (
                    <input
                      type="text"
                      className="w-full bg-transparent text-sm font-semibold text-chalk outline-none placeholder:text-fog/60"
                      placeholder="Surprise line (e.g. replacement weatherhead)"
                      value={line.name}
                      onChange={(e) =>
                        updateLine(i, { name: e.target.value })
                      }
                      aria-label={`Surprise line ${i + 1} name`}
                    />
                  ) : (
                    <div className="truncate text-sm font-semibold text-chalk">
                      {line.name || `Line ${i + 1}`}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-fog">
                    {line.new_at_closeout
                      ? "New — wasn't in the original quote"
                      : `Quoted ${formatUSD(line.quoted_cents)}`}
                  </div>
                </div>
                {line.new_at_closeout && (
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-fog transition hover:bg-white/5 hover:text-rust"
                    aria-label={`Remove surprise line ${i + 1}`}
                  >
                    <span aria-hidden>×</span>
                  </button>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="flex flex-1 items-center gap-1 rounded bg-steel px-2 py-2">
                  <span className="text-xs text-fog">Actual $</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    className="w-full min-w-0 bg-transparent text-right font-mono text-sm text-chalk outline-none"
                    value={line.actual_cents === 0 ? "" : line.actual_cents / 100}
                    onChange={(e) =>
                      updateLine(i, {
                        actual_cents: toCents(
                          parseFloat(e.target.value) || 0
                        ),
                      })
                    }
                    aria-label={`${line.name || `Line ${i + 1}`} actual cost`}
                  />
                </div>
                {!line.new_at_closeout && (
                  <button
                    type="button"
                    onClick={() =>
                      updateLine(i, { actual_cents: line.quoted_cents })
                    }
                    disabled={matches}
                    className="shrink-0 rounded border border-white/15 px-3 py-2 text-xs text-fog transition hover:border-white/30 hover:text-chalk disabled:cursor-not-allowed disabled:opacity-40"
                    title="Set actual = quoted for this line"
                  >
                    Same
                  </button>
                )}
              </div>

              {!matches && !line.new_at_closeout && (
                <div
                  className={`mt-2 text-right font-mono text-[11px] ${
                    diff > 0 ? "text-rust" : "text-moss"
                  }`}
                >
                  {diff > 0 ? "+" : ""}
                  {formatUSD(diff)}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={addSurpriseLine}
        className="mt-2 w-full rounded-lg border border-dashed border-white/15 px-3 py-3 text-sm text-fog transition hover:border-white/30 hover:text-chalk"
      >
        + Add surprise line
      </button>

      <p className="mt-2 text-[11px] text-fog">
        Lines pre-fill with what you quoted — tap &ldquo;Same&rdquo; to confirm
        or type a new number. Surprise lines capture materials that weren&rsquo;t
        in the original quote.
      </p>
    </div>
  );
}
