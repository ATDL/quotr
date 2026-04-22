/**
 * Money helpers — cents in, formatted strings out.
 *
 * Rule: internally everything is integer cents. Only format to dollars at the
 * presentation boundary. Floating-point math on dollars is how bugs are born.
 */

export function toCents(dollars: number | string): number {
  const n = typeof dollars === "string" ? parseFloat(dollars) : dollars;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromCents(cents));
}

export function formatPct(pct: number, digits = 1): string {
  if (!Number.isFinite(pct)) return "—";
  return `${pct >= 0 ? "" : "-"}${Math.abs(pct).toFixed(digits)}%`;
}
