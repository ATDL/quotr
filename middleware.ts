import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createClient } from "@supabase/supabase-js";

const BOT_RE =
  /bot|crawler|spider|crawling|googlebot|bingbot|yandexbot|facebookexternalhit|slack|discord|whatsapp|telegram/i;

type CachedExp = { exp: { id: string; split_a: number } | null; at: number };
const expCache = new Map<string, CachedExp>();
const CACHE_TTL_MS = 60_000;

async function getActiveExperiment(host: string) {
  const cached = expCache.get(host);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.exp;
  const supa = createClient(
    process.env.DARTLAB_SUPABASE_URL!,
    process.env.DARTLAB_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await supa
    .from("experiments")
    .select("id, split_a")
    .eq("host", host)
    .eq("entry_path", "/")
    .eq("status", "running")
    .limit(1)
    .maybeSingle();
  const exp = data ?? null;
  expCache.set(host, { exp, at: Date.now() });
  return exp;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") || "";
  const host = request.headers.get("host") || "";

  // DartLab: only run on the landing page root, skip bots, require host.
  if (pathname === "/" && host && !BOT_RE.test(ua)) {
    try {
      const exp = await getActiveExperiment(host);
      if (exp) {
        const variantCookieName = `dart_variant_${exp.id}`;
        let variant = request.cookies.get(variantCookieName)?.value;
        const newCookies: { name: string; value: string; maxAge: number }[] = [];

        let visitorId = request.cookies.get("dart_visitor_id")?.value;
        if (!visitorId) {
          visitorId = crypto.randomUUID();
          newCookies.push({ name: "dart_visitor_id", value: visitorId, maxAge: 60 * 60 * 24 * 365 });
        }

        if (variant !== "a" && variant !== "b") {
          variant = Math.random() < Number(exp.split_a) ? "a" : "b";
          newCookies.push({ name: variantCookieName, value: variant, maxAge: 60 * 60 * 24 * 30 });
        }

        // Hint cookie for the event handler (60s) — also tells the Hero which variant to render.
        newCookies.push({ name: "dart_active_exp", value: exp.id, maxAge: 60 });

        const res = await updateSession(request);
        for (const c of newCookies) {
          res.cookies.set(c.name, c.value, { maxAge: c.maxAge, sameSite: "lax", path: "/" });
        }
        return res;
      }
    } catch {
      // DartLab failure must never break the page — fall through to plain session refresh.
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - api/stripe/webhook (Stripe posts raw body here; middleware would break sig verification)
     * - files with extensions (images, css, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
