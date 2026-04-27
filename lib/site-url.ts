/**
 * Normalize a possibly-bare site URL string into a valid absolute URL.
 *
 * Tolerates the most common Vercel-env-var mistakes:
 *   "foo.com"          → "https://foo.com"
 *   "https://foo.com/" → "https://foo.com"
 *   "  foo.com  "      → "https://foo.com"
 *   garbage            → returns the fallback
 *
 * Used by metadataBase in app/layout.tsx and the Stripe success_url
 * resolver in /dashboard/credits, so a bare domain in
 * NEXT_PUBLIC_SITE_URL doesn't break either path.
 */
export function normalizeSiteUrl(
  raw: string | undefined,
  fallback: string
): string {
  if (!raw) return fallback;
  let s = raw.trim();
  if (!s) return fallback;
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  s = s.replace(/\/$/, "");
  try {
    // Validate — throws if it's still malformed.
    new URL(s);
    return s;
  } catch {
    return fallback;
  }
}
