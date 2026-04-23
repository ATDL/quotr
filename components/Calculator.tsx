"use client";

import { useMemo, useState } from "react";
import { formatUSD, toCents } from "@/lib/utils/money";

/**
 * Free quote calculator — the cold-traffic hook.
 *
 * No auth required. Stateless. If the user wants to save or close out a quote,
 * that flow kicks them into sign-in (handled elsewhere).
 */
type Props = {
  saveAction?: (formData: FormData) => Promise<void>;
};

export default function Calculator({ saveAction }: Props = {}) {
  const [hours, setHours] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [materials, setMaterials] = useState<string>("");
  const [markupPct, setMarkupPct] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [scope, setScope] = useState<string>("");
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

  function reset() {
    setHours("");
    setRate("");
    setMaterials("");
    setMarkupPct("");
    setCustomerName("");
    setScope("");
    setCopied(false);
  }

  async function copyQuote() {
    // Customer-facing output — markup is NEVER shown as a line item.
    // We proportionally roll markup into labor and materials so the
    // itemized lines sum to the total. This is how every pro quoting tool
    // (Jobber, Housecall Pro, ServiceTitan) presents a quote: overhead
    // baked into the rate, never called out.
    const subtotal = laborCents + materialsCents;
    const ratio = subtotal > 0 ? totalCents / subtotal : 1;
    const displayLabor = Math.round(laborCents * ratio);
    // Materials absorbs any rounding drift so the lines sum exactly to total.
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
          <label className="label" htmlFor="markup">
            Markup (%) — internal only
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
            aria-describedby="markup-help"
          />
          <p id="markup-help" className="mt-1 text-[11px] text-fog">
            Never shown to the customer. Rolled silently into the total.
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
      </div>

      <div className="mt-8 rounded-lg border border-white/10 bg-ink p-5">
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
        <button type="button" onClick={reset} className="btn-ghost">
          Reset
        </button>
        {saveAction ? (
          <form action={saveAction}>
            <input type="hidden" name="hours" value={hours} />
            <input type="hidden" name="rate" value={rate} />
            <input type="hidden" name="materials" value={materials} />
            <input type="hidden" name="markupPct" value={markupPct} />
            <input type="hidden" name="customerName" value={customerName} />
            <input type="hidden" name="scope" value={scope} />
            <button
              type="submit"
              disabled={!hasAny}
              className="btn-primary"
              title={!hasAny ? "Enter at least one value to save" : undefined}
            >
              Save quote →
            </button>
          </form>
        ) : (
          <a href="/login" className="btn-ghost">
            Save &amp; close out later
          </a>
        )}
      </div>

      <p className="mt-4 text-xs text-fog">
        &ldquo;Copy quote&rdquo; produces a customer-facing version with markup
        baked silently into the total. Your internal breakdown above stays
        here.
      </p>
      {!saveAction && (
        <p className="mt-1 text-xs text-fog">
          Close out this job later to see quoted vs. actual, profit, and
          variance. First close-out is free.
        </p>
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
