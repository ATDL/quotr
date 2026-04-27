import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PACK_PRICE_DOLLARS,
  PACK_SIZE,
  isPack,
  priceIdForPack,
  stripe,
  type Pack,
} from "@/lib/stripe";

/**
 * /dashboard/credits — buy credit packs.
 *
 * Hosted Checkout Session approach (no client-side Stripe SDK):
 *   form action → server action → stripe.checkout.sessions.create →
 *   redirect(session.url) → user pays on stripe.com → webhook credits them.
 */
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: { msg?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("credits_balance")
    .eq("id", user.id)
    .single();
  const credits = profile?.credits_balance ?? 0;

  const banner = bannerForMsg(searchParams.msg);

  async function checkout(formData: FormData) {
    "use server";

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const packRaw = formData.get("pack");
    if (!isPack(packRaw)) redirect("/dashboard/credits?msg=invalid_pack");
    const pack = packRaw as Pack;

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceIdForPack(pack), quantity: 1 }],
      success_url: `${origin}/dashboard/credits?msg=purchased`,
      cancel_url: `${origin}/dashboard/credits?msg=cancelled`,
      client_reference_id: user.id,
      // Metadata flows through to the webhook event so it can credit the
      // right user with the right pack size. Don't trust amount alone —
      // someone could swap price IDs at checkout.
      metadata: { user_id: user.id, pack },
    });

    if (!session.url) {
      throw new Error("Stripe Checkout session has no url");
    }
    redirect(session.url);
  }

  return (
    <div className="space-y-8">
      <header>
        <a
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-2 text-sm text-fog hover:text-chalk"
        >
          <span aria-hidden>←</span> Back to My jobs
        </a>
        <h1 className="text-3xl font-bold tracking-tight">Credits</h1>
        <p className="mt-1 text-sm text-fog">
          One credit = one close-out. First close-out is always free. Packs
          never expire.
        </p>
      </header>

      {banner && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 text-sm ${
            banner.tone === "ok"
              ? "border-moss/30 bg-moss/5"
              : "border-rust/40 bg-rust/5"
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-steel p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wider text-fog">
            Balance
          </span>
          <span className="font-mono text-3xl font-bold text-safety">
            {credits}
          </span>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <PackBuyCard pack="starter" action={checkout} />
        <PackBuyCard pack="pro" action={checkout} highlight />
      </section>

      <ul className="space-y-1 text-sm text-fog">
        <li>• Credits never expire.</li>
        <li>• Full refund on unused packs within 30 days — email hello@quotr.app.</li>
        <li>• You stay on the customer-facing Stripe page until you pay or cancel.</li>
      </ul>
    </div>
  );
}

function PackBuyCard({
  pack,
  action,
  highlight = false,
}: {
  pack: Pack;
  action: (formData: FormData) => Promise<void>;
  highlight?: boolean;
}) {
  const size = PACK_SIZE[pack];
  const price = PACK_PRICE_DOLLARS[pack];
  const perUnit = (price / size).toFixed(2);
  const name = pack === "starter" ? "Starter" : "Pro";

  return (
    <form
      action={action}
      className={`relative rounded-xl border bg-steel p-6 ${
        highlight ? "border-rust/60 ring-1 ring-rust/40" : "border-white/10"
      }`}
    >
      <input type="hidden" name="pack" value={pack} />
      {highlight && (
        <span className="absolute -top-2 right-4 rounded-full bg-rust px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          Best value
        </span>
      )}
      <h3 className="text-xl font-bold">{name}</h3>
      <div className="mt-2 font-mono text-4xl font-bold">${price}</div>
      <div className="mt-1 text-sm text-fog">{size} close-outs</div>
      <div className="mt-1 text-xs text-fog">${perUnit} per close-out</div>
      <button type="submit" className="btn-primary mt-6 w-full">
        Buy {name} pack
      </button>
    </form>
  );
}

function bannerForMsg(
  msg: string | undefined
): { tone: "ok" | "warn"; text: string } | null {
  switch (msg) {
    case "purchased":
      return {
        tone: "ok",
        text: "Pack purchased. Credits will appear within a few seconds — refresh if you don't see them yet.",
      };
    case "cancelled":
      return { tone: "warn", text: "Checkout cancelled. No charge made." };
    case "invalid_pack":
      return {
        tone: "warn",
        text: "Couldn't process that pack. Pick one below.",
      };
    default:
      return null;
  }
}
