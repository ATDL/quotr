/**
 * Materials line-item helpers.
 *
 * Lines live in JSONB columns on quotes and close_outs (spec ships with
 * two columns on each table: the boolean `*_itemized` flag and the
 * `*_lines` jsonb array). We pass lines from the client to server actions
 * as a JSON-encoded hidden input, then validate here before persisting.
 *
 * Invariant enforced in app code: when materials_itemized = true, the
 * cached materials_cents equals the sum of the line cost_cents. No DB
 * trigger — just keep the math straight at every write point.
 */

export type QuoteLine = {
  id: string;
  name: string;
  cost_cents: number;
  sort: number;
};

export type ActualLine = {
  id: string;
  name: string;
  quoted_cents: number;
  actual_cents: number;
  new_at_closeout?: boolean;
};

function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && Number.isInteger(n);
}

export function parseQuoteLines(raw: unknown): QuoteLine[] {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out: QuoteLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const l = item as Record<string, unknown>;
    const id = typeof l.id === "string" && l.id.length > 0 ? l.id : null;
    const name = typeof l.name === "string" ? l.name.slice(0, 120) : "";
    const cost = typeof l.cost_cents === "number" ? Math.round(l.cost_cents) : NaN;
    const sort = typeof l.sort === "number" ? l.sort : out.length;
    if (!id || !isPositiveInt(cost)) continue;
    out.push({ id, name, cost_cents: cost, sort });
  }
  // Cap at 100 to keep jsonb payload bounded.
  return out.slice(0, 100);
}

export function parseActualLines(raw: unknown): ActualLine[] {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out: ActualLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const l = item as Record<string, unknown>;
    const id = typeof l.id === "string" && l.id.length > 0 ? l.id : null;
    const name = typeof l.name === "string" ? l.name.slice(0, 120) : "";
    const quoted = typeof l.quoted_cents === "number" ? Math.round(l.quoted_cents) : 0;
    const actual = typeof l.actual_cents === "number" ? Math.round(l.actual_cents) : NaN;
    if (!id || !isPositiveInt(actual) || !isPositiveInt(Math.max(quoted, 0))) continue;
    out.push({
      id,
      name,
      quoted_cents: Math.max(quoted, 0),
      actual_cents: actual,
      new_at_closeout: l.new_at_closeout === true,
    });
  }
  return out.slice(0, 100);
}

export function sumLines(
  lines: { cost_cents?: number; actual_cents?: number }[]
): number {
  return lines.reduce((s, l) => {
    const v =
      typeof l.cost_cents === "number"
        ? l.cost_cents
        : typeof l.actual_cents === "number"
        ? l.actual_cents
        : 0;
    return s + v;
  }, 0);
}

/**
 * Per-line customer-facing cost with the quote's margin distributed
 * proportionally — multiplies by the gross-up ratio (customerTotal / subtotal).
 * Round after multiplication; accept small drift vs. total per spec.
 */
export function applyGrossUpRatio(cents: number, ratio: number): number {
  return Math.round(cents * ratio);
}

/** Format "$1,346" with no cents — customer-facing, per spec. */
export function formatWholeDollars(cents: number): string {
  const d = Math.round(cents / 100);
  return "$" + d.toLocaleString("en-US");
}

/** Pad a label to exact width, used to align itemized customer output. */
export function padLabel(label: string, width: number): string {
  if (label.length >= width) return label;
  return label + " ".repeat(width - label.length);
}
