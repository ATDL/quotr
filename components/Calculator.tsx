"use client";

import { useMemo, useRef, useState } from "react";
import { formatUSD, toCents } from "@/lib/utils/money";
import {
  formatWholeDollars,
  padLabel,
  type QuoteLine,
} from "@/lib/materials";
import { computeQuote, MARGIN_MAX } from "@/lib/pricing";

type Props = {
  saveAction?: (formData: FormData) => Promise<void>;
};

function newLineId(): string {
  // Modern browsers + Node 19+ have crypto.randomUUID. Fall back to a
  // timestamped random if an older runtime ever hits this path.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function Calculator({ saveAction }: Props = {}) {
  // Landing page gets a worked example so the value is visible on first paint.
  // Authenticated new-quote flow (saveAction present) starts empty.
  const exampleMode = !saveAction;

  const [hours, setHours] = useState<string>(exampleMode ? "8" : "");
  const [rate, setRate] = useState<string>(exampleMode ? "95" : "");
  const [materials, setMaterials] = useState<string>(
    exampleMode ? "320" : ""
  );
  const [marginPct, setMarginPct] = useState<string>(
    exampleMode ? "20" : ""
  );
  const [customerName, setCustomerName] = useState<string>("");
  const [scope, setScope] = useState<string>("");
  const [watchingFor, setWatchingFor] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Itemized materials — default is single-field (unchanged UX).
  const [materialsItemized, setMaterialsItemized] = useState(false);
  const [materialsLines, setMaterialsLines] = useState<QuoteLine[]>([]);

  const {
    laborCents,
    materialsCents,
    subtotalCents,
    profitCents,
    totalCents,
    marginPctApplied,
    equivalentMarkupPct,
    marginEntered,
    hasAny,
  } = useMemo(() => {
    const h = parseFloat(hours) || 0;
    const r = parseFloat(rate) || 0;
    const singleMaterials = parseFloat(materials) || 0;
    const marginEntered = parseFloat(marginPct) || 0;

    const laborCents = toCents(h * r);
    const linesSum = materialsLines.reduce((s, l) => s + l.cost_cents, 0);
    const materialsCents = materialsItemized
      ? linesSum
      : toCents(singleMaterials);

    const result = computeQuote({
      laborCents,
      materialsCents,
      marginPct: marginEntered,
    });

    return {
      laborCents,
      materialsCents,
      subtotalCents: result.subtotalCents,
      profitCents: result.profitCents,
      totalCents: result.customerTotalCents,
      marginPctApplied: result.marginPctApplied,
      equivalentMarkupPct: result.equivalentMarkupPct,
      marginEntered,
      hasAny: h > 0 || r > 0 || materialsCents > 0,
    };
  }, [hours, rate, materials, marginPct, materialsItemized, materialsLines]);

  function clearAll() {
    setHours("");
    setRate("");
    setMaterials("");
    setMarginPct("");
    setCustomerName("");
    setScope("");
    setWatchingFor("");
    setMaterialsItemized(false);
    setMaterialsLines([]);
    setCopied(false);
  }

  function toggleItemize() {
    if (materialsItemized) {
      // Collapse itemized → single total
      const sum = materialsLines.reduce((s, l) => s + l.cost_cents, 0);
      setMaterials(sum > 0 ? String(sum / 100) : "");
      setMaterialsLines([]);
      setMaterialsItemized(false);
      return;
    }
    // Expanding: seed the first line with the existing single-field value
    // (if any) so the user never loses data.
    const m = parseFloat(materials) || 0;
    if (m > 0) {
      setMaterialsLines([
        {
          id: newLineId(),
          name: "Materials",
          cost_cents: toCents(m),
          sort: 0,
        },
      ]);
    }
    setMaterials("");
    setMaterialsItemized(true);
  }

  async function copyQuote() {
    // Customer-facing output — margin is NEVER shown as a line item.
    // We compute a gross-up ratio (customerTotal / subtotal) and apply it
    // to each visible line, so the customer sees clean labor + materials
    // numbers that sum to the total.
    const subtotal = laborCents + materialsCents;
    const ratio = subtotal > 0 ? totalCents / subtotal : 1;

    const header = [
      customerName ? `Quote for ${customerName}` : `Quote`,
      scope ? `Scope: ${scope}` : null,
      "",
    ].filter(Boolean);

    let body: string[];

    if (materialsItemized && materialsLines.length > 0) {
      // Itemized path.
      const rawLines: { name: string; cents: number }[] = [];
      const displayLabor = Math.round(laborCents * ratio);
      if (displayLabor > 0) {
        const h = parseFloat(hours) || 0;
        rawLines.push({
          name: h > 0 ? `Labor (${h} hrs)` : "Labor",
          cents: displayLabor,
        });
      }
      materialsLines.forEach((l, i) => {
        const cents = Math.round(l.cost_cents * ratio);
        if (cents <= 0) return; // omit zero-cost lines from customer view
        const name = l.name.trim() || `Materials item ${i + 1}`;
        rawLines.push({ name, cents });
      });

      // Spec: max 8 lines in customer view. Collapse the tail.
      let lineView = rawLines;
      if (rawLines.length > 8) {
        const keep = rawLines.slice(0, 7);
        const tail = rawLines.slice(7);
        const tailSum = tail.reduce((s, r) => s + r.cents, 0);
        lineView = [...keep, { name: "Fittings & misc", cents: tailSum }];
      }

      // Align to widest label (min 16 per spec) for monospace rendering.
      const width = Math.max(16, ...lineView.map((r) => r.name.length + 1));
      const ruleWidth = width + 10;

      body = [
        ...lineView.map(
          (r) => `${padLabel(r.name + ":", width)}${formatWholeDollars(r.cents)}`
        ),
        "─".repeat(ruleWidth),
        `${padLabel("Total:", width)}${formatWholeDollars(totalCents)}`,
      ];
    } else {
      // Single-line path — unchanged shape.
      const displayLabor = Math.round(laborCents * ratio);
      const displayMaterials = Math.max(0, totalCents - displayLabor);
      body = [
        displayLabor > 0 ? `Labor: ${formatUSD(displayLabor)}` : "",
        displayMaterials > 0 ? `Materials: ${formatUSD(displayMaterials)}` : "",
        `Total: ${formatUSD(totalCents)}`,
      ].filter(Boolean);
    }

    const text = [...header, ...body].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore clipboard errors */
    }
  }

  return (
    <div id="calculator" className="card">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Quote calculator</h2>
        <span className="text-xs uppercase tracking-wider text-fog">
          Free · no account
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="hours">
            Labor hours
          </label>
          <input
            id="hours"
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.25"
            placeholder="e.g. 8"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="rate">
            Hourly rate ($)
          </label>
          <input
            id="rate"
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            placeholder="e.g. 95"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>

        <div className={materialsItemized ? "md:col-span-2" : ""}>
          <MaterialsField
            itemized={materialsItemized}
            single={materials}
            onSingleChange={setMaterials}
            lines={materialsLines}
            onLinesChange={setMaterialsLines}
            onToggle={toggleItemize}
          />
        </div>

        <div>
          <label
            className="label flex items-center justify-between gap-3"
            htmlFor="margin"
          >
            <span>Profit margin (%) — what you keep</span>
            <span className="text-[10px] normal-case tracking-normal text-fog">
              Internal only — rolled silently into total
            </span>
          </label>
          <input
            id="margin"
            className="input"
            type="number"
            inputMode="numeric"
            min="0"
            max={MARGIN_MAX}
            step="1"
            placeholder="e.g. 20"
            value={marginPct}
            onChange={(e) => setMarginPct(e.target.value)}
            aria-describedby="margin-help"
          />
          <p id="margin-help" className="mt-1 text-xs text-fog">
            {marginExplainer({
              hasAny,
              marginEntered,
              marginPctApplied,
              equivalentMarkupPct,
              profitCents,
            })}
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="customer">
            Customer name — optional
          </label>
          <input
            id="customer"
            className="input"
            type="text"
            placeholder="e.g. Mrs. Alvarez"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="scope">
            Scope of work — optional
          </label>
          <input
            id="scope"
            className="input"
            type="text"
            placeholder="e.g. Replace breaker panel, 200A upgrade"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="watchingFor">
            What could surprise you on this job? — optional
          </label>
          <textarea
            id="watchingFor"
            className="input min-h-[60px] resize-none"
            placeholder="e.g. drywall behind the panel might be rotted; drive is farther than it looks"
            value={watchingFor}
            onChange={(e) => setWatchingFor(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-fog">
            We&rsquo;ll ask you at close-out whether this was right. Builds
            your instinct over time.
          </p>
        </div>
      </div>

      <details className="group mt-6 rounded-lg border border-safety/25 bg-safety/5 p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-safety">
          <span className="mr-2 group-open:hidden">▸</span>
          <span className="mr-2 hidden group-open:inline">▾</span>
          Before you quote — did you factor these in?
        </summary>
        <ul className="mt-3 space-y-1.5 text-sm text-fog">
          <li>• Drive time, both ways, plus fuel</li>
          <li>• Materials pickup or a second trip for parts</li>
          <li>• Site prep, cleanup, and haul-away</li>
          <li>• Risk of a callback or warranty fix</li>
          <li>• Permit fees or inspection delays</li>
        </ul>
        <p className="mt-3 text-xs text-fog">
          These are the lines that sink margins. Quotr won&rsquo;t pad your
          number — but a few close-outs will show you exactly which job types
          you keep underbidding.
        </p>
      </details>

      <div className="mt-6 rounded-lg border border-white/10 bg-ink p-5">
        <div className="mb-3 text-[11px] uppercase tracking-wider text-fog">
          Your view (internal)
        </div>
        <div className="space-y-2 text-sm">
          <Row label="Labor" cents={laborCents} />
          <Row label="Materials" cents={materialsCents} />
          <div className="flex items-baseline justify-between border-t border-white/5 pt-2 font-semibold">
            <span className="text-fog">Your costs</span>
            <span className="font-mono">
              {subtotalCents === 0 ? "—" : formatUSD(subtotalCents)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-fog">Profit</span>
            <span
              className={`font-mono ${
                profitCents > 0 ? "text-moss" : "text-fog"
              }`}
            >
              {profitCents === 0 ? "—" : formatUSD(profitCents)}
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
          <span className="text-sm uppercase tracking-wider text-fog">
            Customer sees
          </span>
          <span className="font-mono text-3xl font-bold text-safety">
            {hasAny ? formatUSD(totalCents) : "—"}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-fog">
          Margin is rolled silently into the total. Breakdown above is yours
          only.
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={copyQuote}
          disabled={!hasAny}
          className="btn-primary"
          title={!hasAny ? "Enter at least one value to copy" : undefined}
        >
          {copied ? "Copied!" : "Copy quote"}
        </button>
        <button type="button" onClick={clearAll} className="btn-ghost">
          Clear
        </button>
        {saveAction && (
          <form action={saveAction}>
            <input type="hidden" name="hours" value={hours} />
            <input type="hidden" name="rate" value={rate} />
            <input type="hidden" name="materials" value={materials} />
            <input type="hidden" name="marginPct" value={marginPct} />
            <input type="hidden" name="customerName" value={customerName} />
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="watchingFor" value={watchingFor} />
            <input
              type="hidden"
              name="materialsItemized"
              value={materialsItemized ? "true" : "false"}
            />
            <input
              type="hidden"
              name="materialsLines"
              value={JSON.stringify(materialsLines)}
            />
            <button
              type="submit"
              disabled={!hasAny}
              className="btn-primary"
              title={!hasAny ? "Enter at least one value to save" : undefined}
            >
              Save quote →
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-xs text-fog">
        &ldquo;Copy quote&rdquo; produces a customer-facing version with your
        margin baked silently into the total. Your internal breakdown above
        stays here.
      </p>

      {/* Promoted save CTA — landing page only, shown once the calc has values */}
      {!saveAction && hasAny && (
        <div className="mt-6 rounded-lg border border-safety/30 bg-safety/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-chalk">
                Want to see if you actually made money?
              </div>
              <div className="mt-1 text-sm text-fog">
                Save this quote. When the job&rsquo;s done, close it out and
                we&rsquo;ll show quoted vs. actual, profit dollars, and profit
                percent.
              </div>
            </div>
            <a href="/login?mode=signup" className="btn-primary shrink-0">
              Save quote →
            </a>
          </div>
          <div className="mt-2 text-xs text-fog">
            First close-out is free. No card to save.
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-fog">{label}</span>
      <span className="font-mono">{cents === 0 ? "—" : formatUSD(cents)}</span>
    </div>
  );
}

/**
 * Static helper line under the margin input. Three states:
 *   1. No costs entered yet → show what the field is for
 *   2. Margin > 80 (clamped) → "Capped at 80% — anything higher is almost certainly a typo"
 *   3. Normal → "X% margin = Y% markup on costs · You keep $Z on this quote"
 *      with a "working for free" warning at 0%
 */
function marginExplainer({
  hasAny,
  marginEntered,
  marginPctApplied,
  equivalentMarkupPct,
  profitCents,
}: {
  hasAny: boolean;
  marginEntered: number;
  marginPctApplied: number;
  equivalentMarkupPct: number;
  profitCents: number;
}): React.ReactNode {
  if (!hasAny) {
    return (
      <>What you keep as a % of customer total. Cap {MARGIN_MAX}%.</>
    );
  }
  if (marginEntered > MARGIN_MAX) {
    return (
      <span className="text-rust">
        Capped at {MARGIN_MAX}% — anything higher is almost certainly a typo.
      </span>
    );
  }
  if (marginPctApplied === 0) {
    return (
      <>
        0% margin = 0% markup on costs ·{" "}
        <span className="font-mono text-chalk">$0</span> kept ·{" "}
        <span className="text-rust">⚠ You&rsquo;re working for free</span>
      </>
    );
  }
  return (
    <>
      {marginPctApplied}% margin = {equivalentMarkupPct.toFixed(1)}% markup on
      costs · You keep{" "}
      <span className="font-mono text-chalk">{formatUSD(profitCents)}</span> on
      this quote
    </>
  );
}

type MaterialsFieldProps = {
  itemized: boolean;
  single: string;
  onSingleChange: (v: string) => void;
  lines: QuoteLine[];
  onLinesChange: (lines: QuoteLine[]) => void;
  onToggle: () => void;
};

function MaterialsField({
  itemized,
  single,
  onSingleChange,
  lines,
  onLinesChange,
  onToggle,
}: MaterialsFieldProps) {
  const [draftName, setDraftName] = useState("");
  const [draftCost, setDraftCost] = useState("");
  const draftNameRef = useRef<HTMLInputElement>(null);
  const draftCostRef = useRef<HTMLInputElement>(null);

  const linesSumCents = lines.reduce((s, l) => s + l.cost_cents, 0);

  function commitDraft() {
    const name = draftName.trim();
    const costNum = parseFloat(draftCost) || 0;
    if (!name && costNum === 0) return;
    onLinesChange([
      ...lines,
      {
        id: newLineId(),
        name,
        cost_cents: toCents(costNum),
        sort: lines.length,
      },
    ]);
    setDraftName("");
    setDraftCost("");
    draftNameRef.current?.focus();
  }

  function updateLine(idx: number, patch: Partial<QuoteLine>) {
    onLinesChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
    onLinesChange(
      lines
        .filter((_, i) => i !== idx)
        .map((l, i) => ({ ...l, sort: i }))
    );
  }

  function onDraftKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    field: "name" | "cost"
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "name") {
        draftCostRef.current?.focus();
      } else {
        commitDraft();
      }
    }
  }

  if (!itemized) {
    return (
      <>
        <label
          className="label flex items-center justify-between gap-3"
          htmlFor="materials"
        >
          <span>Materials cost ($)</span>
          <button
            type="button"
            onClick={onToggle}
            className="text-[10px] normal-case tracking-normal text-fog underline-offset-2 hover:text-chalk hover:underline"
            aria-expanded="false"
            aria-controls="materials-editor"
          >
            + Itemize
          </button>
        </label>
        <input
          id="materials"
          className="input"
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          placeholder="e.g. 320"
          value={single}
          onChange={(e) => onSingleChange(e.target.value)}
        />
      </>
    );
  }

  return (
    <div id="materials-editor">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="label mb-0">Materials</span>
        <button
          type="button"
          onClick={onToggle}
          className="text-[10px] normal-case tracking-normal text-fog underline-offset-2 hover:text-chalk hover:underline"
        >
          Collapse to single line
        </button>
      </div>

      {lines.length === 0 && (
        <p className="mb-2 rounded-lg border border-dashed border-white/10 p-3 text-xs text-fog">
          No lines yet. Add items below, or collapse back to a single total.
        </p>
      )}

      {lines.length > 0 && (
        <ul className="space-y-2" role="list">
          {lines.map((line, i) => (
            <li
              key={line.id}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink p-2"
            >
              <input
                type="text"
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-chalk outline-none placeholder:text-fog/60"
                placeholder="Item (e.g. Breaker box)"
                value={line.name}
                onChange={(e) => updateLine(i, { name: e.target.value })}
                aria-label={`Line ${i + 1} item name`}
              />
              <div className="flex items-center gap-1 rounded bg-steel px-2 py-2">
                <span className="text-xs text-fog">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  className="w-20 bg-transparent text-right font-mono text-sm text-chalk outline-none"
                  placeholder="0"
                  value={line.cost_cents === 0 ? "" : line.cost_cents / 100}
                  onChange={(e) =>
                    updateLine(i, {
                      cost_cents: toCents(parseFloat(e.target.value) || 0),
                    })
                  }
                  aria-label={`Line ${i + 1} cost`}
                />
              </div>
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-fog transition hover:bg-white/5 hover:text-rust"
                aria-label={`Remove line: ${line.name || "untitled"}`}
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Quick-add row */}
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-white/15 p-2">
        <input
          ref={draftNameRef}
          type="text"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-chalk outline-none placeholder:text-fog/60"
          placeholder="+ Add item…"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => onDraftKeyDown(e, "name")}
          aria-label="New line item name"
        />
        <div className="flex items-center gap-1 rounded bg-steel/60 px-2 py-2">
          <span className="text-xs text-fog">$</span>
          <input
            ref={draftCostRef}
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            className="w-20 bg-transparent text-right font-mono text-sm text-chalk outline-none"
            placeholder="0"
            value={draftCost}
            onChange={(e) => setDraftCost(e.target.value)}
            onKeyDown={(e) => onDraftKeyDown(e, "cost")}
            aria-label="New line cost"
          />
        </div>
        <button
          type="button"
          onClick={commitDraft}
          disabled={!draftName.trim() && !draftCost}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-safety/10 text-lg font-bold text-safety transition hover:bg-safety/20 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Add line"
        >
          <span aria-hidden>+</span>
        </button>
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3">
        <span className="text-xs uppercase tracking-wider text-fog">
          Materials subtotal · {lines.length} item
          {lines.length === 1 ? "" : "s"}
        </span>
        <span className="font-mono text-lg text-chalk">
          {linesSumCents === 0 ? "—" : formatUSD(linesSumCents)}
        </span>
      </div>

      {lines.length >= 20 && (
        <p className="mt-2 text-[11px] text-fog">
          That&rsquo;s a lot of lines — is this a remodel? Consider collapsing
          similar items into categories.
        </p>
      )}
    </div>
  );
}
