import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /auth/sign-out → clears the Supabase session cookie and bounces home.
 * POST-only so links can't accidentally sign the user out via a GET preload.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
