"use client";

import { useMemo, useState } from "react";
import { formatUSD, toCents } from "@/lib/utils/money";

type Props = {
  saveAction?: (formData: FormData) => Promise<void>;
};

export default function Calculator({ saveAction }: Props = {}) {
  // Landing page gets a worked example so the value is visible on first paint.
  // Authenticated new-quote flow (saveAction present) starts empty.
  const exampleMode = !saveAction;

  const [hours, setHours] = useState<string>(exampleMode ? "8" : "");
  const [rate, setRate] = useState<string>(exampleMode ? "95" : "");
  const [materials, setMaterials] = useState<string>(
    exampleMode ? "320" : ""
  );
  const [markupPct, setMarkupPct] = useState<string>(
    exampleMode ? "15" : ""
  );
  const [customerName, setCustomerName] = useState<string>("");
  const [scope, setScope] = useState<string>("");
  const [watchingFor, setWatchingFor] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const { laborCents, materialsCents, markupCents, totalCents, hasAny } =
    useMemo(() => {
      const h = parseFloat(hours) || 0;
      const r = parseFloat(rate) || 0;
      const m = parseFloat(materials) || 0;
      const mk = parseFloat(markupPct) || 0;

      const laborCents = toCents(h * r);
      const materialsCents = toCents(m);
      const subtotal = laborCents + materialsCents;
      const markupCents = Math.round(subtotal * (mk / 100));
      const totalCents = subtotal + markupCents;

      return {
        laborCents,
        materialsCents,
        markupCents,
        totalCents,
        hasAny: h > 0 || r > 0 || m > 0,
      };
    }, [hours, rate, materials, markupPct]);

  function clearAll() {
    setHours("");
    setRate("");
    setMaterials("");
    setMarkupPct("");
    setCustomerName("");
    setScope("");
    setWatchingFor("");
    setCopied(false);
  }

  async function copyQuote() {
    // Customer-facing output — markup is NEVER shown as a line item.
    // We proportionally roll markup into labor and materials so the
    // itemized lines sum to the total.
    const subtotal = laborCents + materialsCents;
    const ratio = subtotal > 0 ? totalCents / subtotal : 1;
    const displayLabor = Math.round(laborCents * ratio);
    const displayMaterials = Math.max(0, totalCents - displayLabor);

    const lines = [
      customerName ? `Quote for ${customerName}` : `Quote`,
      scope ? `Scope: ${scope}` : null,
      "",
      displayLabor > 0 ? `Labor: ${formatUSD(displayLabor)}` : null,
      displayMaterials > 0
        ? `Materials: ${formatUSD(displayMaterials)}`
        : null,
      `Total: ${formatUSD(totalCents)}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(lines);
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

        <div>
          <label className="label" htmlFor="materials">
            Materials cost ($)
          </label>
          <input
            id="materials"
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            placeholder="e.g. 320"
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
          />
        </div>

        <div>
          <label
            className="label flex items-center justify-between gap-3"
            htmlFor="markup"
          >
            <span>Markup (%)</span>
            <span className="text-[10px] normal-case tracking-normal text-fog">
              Internal only — rolled silently into total
            </span>
          </label>
          <input
            id="markup"
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            placeholder="e.g. 15"
            value={markupPct}
            onChange={(e) => setMarkupPct(e.target.value)}
          />
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
          {markupCents > 0 && (
            <Row
              label={`Markup (${markupPct}%) — hidden from customer`}
              cents={markupCents}
            />
          )}
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
          <span className="text-sm uppercase tracking-wider text-fog">
            Quoted total
          </span>
          <span className="font-mono text-3xl font-bold text-safety">
            {hasAny ? formatUSD(totalCents) : "—"}
          </span>
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3">
          <span className="text-sm uppercase tracking-wider text-fog">
            Customer sees
          </span>
          <span className="font-mono text-2xl text-chalk">
            {hasAny ? formatUSD(totalCents) : "—"}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-fog">
          Markup is rolled silently into the total. Breakdown above is yours
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
            <input type="hidden" name="markupPct" value={markupPct} />
            <input type="hidden" name="customerName" value={customerName} />
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="watchingFor" value={watchingFor} />
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
        &ldquo;Copy quote&rdquo; produces a customer-facing version with markup
        baked silently into the total. Your internal breakdown above stays
        here.
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
