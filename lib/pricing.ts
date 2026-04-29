/**
 * Canonical pricing math for Quotr.
 *
 * Margin = profit / customer_total (what you keep as a % of revenue).
 * Markup = profit / cost.
 *
 * Quotr accepts margin %, computes customer_total as cost / (1 - margin/100).
 * The "equivalent markup" is shown next to the input so users with
 * markup-trained brains can sanity-check.
 *
 * Worked example (used as the canonical pin for any future test):
 *   laborCents = 76000  (8h × $95)
 *   materialsCents = 32000
 *   subtotalCents = 108000
 *   marginPct = 20
 *   customerTotalCents = 108000 / (1 - 0.20) = 135000
 *   profitCents = 27000
 *   equivalentMarkupPct = 25.0
 */

export const MARGIN_MIN = 0;
export const MARGIN_MAX = 80;

export function clampMargin(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MARGIN_MAX, Math.max(MARGIN_MIN, n));
}

export type ComputeQuoteInput = {
  laborCents: number;
  materialsCents: number;
  marginPct: number;
};

export type ComputeQuoteResult = {
  subtotalCents: number;
  customerTotalCents: number;
  profitCents: number;
  marginPctApplied: number;
  equivalentMarkupPct: number;
};

export function computeQuote(i: ComputeQuoteInput): ComputeQuoteResult {
  const subtotalCents = Math.max(
    0,
    Math.round((i.laborCents || 0) + (i.materialsCents || 0))
  );
  const marginPctApplied = clampMargin(i.marginPct);
  const customerTotalCents =
    subtotalCents <= 0
      ? 0
      : Math.round(subtotalCents / (1 - marginPctApplied / 100));
  const profitCents = customerTotalCents - subtotalCents;
  const equivalentMarkupPct =
    subtotalCents > 0
      ? (customerTotalCents / subtotalCents - 1) * 100
      : 0;

  return {
    subtotalCents,
    customerTotalCents,
    profitCents,
    marginPctApplied,
    equivalentMarkupPct,
  };
}

/**
 * Gross-up ratio used to distribute margin proportionally across customer-
 * facing line items (e.g. itemized materials in the copy-quote output).
 * Equal to customerTotal / subtotal. With no costs, returns 1.
 */
export function grossUpRatio(
  subtotalCents: number,
  customerTotalCents: number
): number {
  return subtotalCents > 0 ? customerTotalCents / subtotalCents : 1;
}
