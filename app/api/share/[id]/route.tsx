import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

/**
 * Public share-card endpoint. Returns a 1080x1080 PNG with only
 * privacy-safe fields: variance %, headline, takeaway, and job type.
 *
 * No customer name, no dollar amounts, no scope. The brief's privacy
 * default is maximum; we honor that here by never querying those columns.
 *
 * Uses the service-role key because this endpoint is intentionally public
 * — friends the user shares with don't have the user's cookies. RLS would
 * block them; service role bypasses RLS. We compensate by pulling only
 * non-sensitive columns.
 */

type HeatId = "heat-max" | "heat-warn" | "heat-ok" | "heat-sandbag";

function heatFor(variance: number): { id: HeatId; headline: string; takeaway: string } {
  if (variance >= 20) {
    return {
      id: "heat-max",
      headline: "Big miss.",
      takeaway: "Under-quoted. Next one needs more buffer.",
    };
  }
  if (variance >= 10) {
    return {
      id: "heat-warn",
      headline: "Under.",
      takeaway: "A real miss. Worth watching if it keeps happening.",
    };
  }
  if (variance >= 3) {
    return {
      id: "heat-warn",
      headline: "Tight.",
      takeaway: "A little under. Close-out earning its keep.",
    };
  }
  if (variance >= -3) {
    return {
      id: "heat-ok",
      headline: "Dead eye.",
      takeaway: "Called it. Within 3% of actual.",
    };
  }
  if (variance >= -10) {
    return {
      id: "heat-ok",
      headline: "Comfortable.",
      takeaway: "Quoted with room. Kept it as margin.",
    };
  }
  return {
    id: "heat-sandbag",
    headline: "Sandbagged.",
    takeaway: "Quoted high and still won the job.",
  };
}

function heatColor(id: HeatId): string {
  return {
    "heat-max": "#F5A524",
    "heat-warn": "#E07A3A",
    "heat-ok": "#3FA373",
    "heat-sandbag": "#6AA6B8",
  }[id];
}

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return new Response("Share images not configured", { status: 500 });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  // Privacy: only query fields that are safe to render publicly.
  const { data: closeOut } = await supabase
    .from("close_outs")
    .select("computed_variance_pct, job_type")
    .eq("quote_id", params.id)
    .maybeSingle();

  if (!closeOut) {
    return new Response("Not found", { status: 404 });
  }

  const variance = Number(closeOut.computed_variance_pct);
  const heat = heatFor(variance);
  const color = heatColor(heat.id);
  const sign = variance > 0 ? "+" : variance < 0 ? "−" : "";
  const pct = `${sign}${Math.abs(variance).toFixed(0)}%`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0B0B0C",
          color: "#F5F5F3",
          padding: 80,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              color: "#C55B2E",
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: -0.5,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "#C55B2E",
              }}
            />
            Quotr
          </div>
          {closeOut.job_type && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 20px",
                borderRadius: 999,
                border: "1px solid rgba(245,165,36,0.4)",
                background: "rgba(245,165,36,0.1)",
                color: "#F5A524",
                fontSize: 22,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {String(closeOut.job_type).slice(0, 28)}
            </div>
          )}
        </div>

        {/* Hero block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexGrow: 1,
            textAlign: "center",
          }}
        >
          <div
            style={{
              color,
              fontSize: 56,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            {heat.headline}
          </div>
          <div
            style={{
              color,
              fontSize: 240,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: -4,
            }}
          >
            {pct}
          </div>
          <div
            style={{
              color: "#F5F5F3",
              fontSize: 34,
              fontWeight: 600,
              marginTop: 48,
              maxWidth: 820,
              lineHeight: 1.25,
            }}
          >
            {heat.takeaway}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#9AA0A6",
            fontSize: 22,
          }}
        >
          <span>Quote it. Close it out. See if you made money.</span>
          <span>quotr.app</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      // 7 days public cache — the image is derived from immutable close-out
      // data so repeated shares hit the CDN instead of re-rendering.
      headers: {
        "cache-control":
          "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400",
      },
    }
  );
}
