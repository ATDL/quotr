import Stripe from "stripe";

/**
 * Stripe server client + pack metadata. Server-only — never import this
 * from client components. The publishable key isn't used (we use hosted
 * Checkout Sessions, not Elements), so there's no client-side Stripe SDK
 * surface in this app.
 */

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Stripe payments are disabled."
      );
    }
    _stripe = new Stripe(key, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return _stripe;
}

export type Pack = "starter" | "pro";

// Pack size matches the schema CHECK constraint: pack_size in (10, 40).
export const PACK_SIZE: Record<Pack, number> = {
  starter: 10,
  pro: 40,
};

export const PACK_PRICE_DOLLARS: Record<Pack, number> = {
  starter: 29,
  pro: 79,
};

export function priceIdForPack(pack: Pack): string {
  const id =
    pack === "starter"
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER
      : process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO;
  if (!id) {
    throw new Error(
      `Stripe price ID for "${pack}" pack is not set (NEXT_PUBLIC_STRIPE_PRICE_${pack.toUpperCase()})`
    );
  }
  return id;
}

export function isPack(v: unknown): v is Pack {
  return v === "starter" || v === "pro";
}
