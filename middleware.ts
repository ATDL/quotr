import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createClient } from "@supabase/supabase-js";

const BOT_RE =
  /bot|crawler|spider|crawling|googlebot|bingbot|yandexbot|facebookexternalhit|slack|discord|whatsapp|telegram/i;

let cachedExp: { id: string; split_a: number } | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 60_000;

async function getActiveExperiment() {
  if (cachedExp && Date.now() - cacheAt < CACHE_TTL_MS) return cachedExp;
  const supa = createClient(
    process.env.DARTLAB_SUPABASE_URL!,
    process.env.DARTLAB_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await supa
    .from("experiments")
    .select("id, split_a")
    .eq("host", "quotr.vercel.app")
    .eq("entry_path", "/")
    .eq("status", "running")
    .limit(1)
    .maybeSingle();
  cachedExp = data ?? null;
  cacheAt = Date.now();
  return cachedExp;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") || "";

  // DartLab: only run on the landing page root, skip bots.
  if (pathname === "/" && !BOT_RE.test(ua)) {
    try {
      const exp = await getActiveExperiment();
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
