import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / magic-link landing handler. Supabase redirects the user here with a
 * `code` query parameter after they click an email link or return from an
 * OAuth provider. We exchange the code for a session cookie and bounce them
 * to the `next` path, defaulting to /dashboard.
 *
 * Security note: `next` is attacker-controllable (the whole URL is in an
 * email / OAuth return). We MUST validate it resolves to the same origin
 * before using it as a redirect target — otherwise this is a classic
 * open-redirect / phishing sink.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = sameOriginTarget(nextParam, origin) ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}

/**
 * Returns the user-requested path only if it resolves to the same origin.
 * Rejects `//evil.com`, `https://evil.com`, `javascript:…`, and anything
 * that `new URL(next, origin)` refuses to parse.
 */
function sameOriginTarget(next: string | null, origin: string): string | null {
  if (!next) return null;
  try {
    const target = new URL(next, origin);
    if (target.origin !== origin) return null;
    return target.pathname + target.search + target.hash;
  } catch {
    return null;
  }
}
