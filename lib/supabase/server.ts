import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Supabase client — for Server Components, Server Actions, and Route
 * Handlers. Uses the publishable key plus the user's auth cookies so RLS
 * policies still apply on the server (server sees the request as "that user").
 *
 * Do NOT use this for webhooks or admin tasks — those need the service client.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — setting cookies there throws.
            // Safe to ignore if middleware is refreshing the session.
          }
        },
      },
    }
  );
}

/**
 * Service-role Supabase client — bypasses RLS. ONLY call this from server-only
 * code that must touch other users' rows (Stripe webhook, admin scripts).
 * Never export via a route that the browser can reach.
 */
export function createServiceClient() {
  const { createClient: createBasicClient } = require("@supabase/supabase-js");
  return createBasicClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
