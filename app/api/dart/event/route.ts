import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const visitorId = req.cookies.get("dart_visitor_id")?.value;
  if (!visitorId) return new NextResponse(null, { status: 204 });

  const ref = req.headers.get("referer") || "";
  let pathname = "/";
  try {
    pathname = new URL(ref).pathname;
  } catch {
    /* fall through with default "/" */
  }

  const host = req.headers.get("host") || "quotr.vercel.app";

  const supa = createClient(
    process.env.DARTLAB_SUPABASE_URL!,
    process.env.DARTLAB_SECRET_KEY!,
    { auth: { persistSession: false } }
  );

  // Visit event — match the experiment by entry_path.
  const { data: byEntry } = await supa
    .from("experiments")
    .select("id")
    .eq("host", host)
    .eq("entry_path", pathname)
    .eq("status", "running")
    .maybeSingle();

  if (byEntry) {
    const v = req.cookies.get(`dart_variant_${byEntry.id}`)?.value;
    if (v === "a" || v === "b") {
      await supa.from("dart_visits").insert({
        experiment_id: byEntry.id,
        variant: v,
        visitor_id: visitorId,
        user_agent: req.headers.get("user-agent") ?? null,
      });
    }
    return new NextResponse(null, { status: 204 });
  }

  // Conversion event — match by conversion_url.
  const { data: byConv } = await supa
    .from("experiments")
    .select("id")
    .eq("host", host)
    .eq("conversion_url", pathname)
    .eq("status", "running")
    .maybeSingle();

  if (byConv) {
    const v = req.cookies.get(`dart_variant_${byConv.id}`)?.value;
    if (v === "a" || v === "b") {
      await supa.from("dart_conversions").insert({
        experiment_id: byConv.id,
        variant: v,
        visitor_id: visitorId,
      });
    }
  }

  return new NextResponse(null, { status: 204 });
}
