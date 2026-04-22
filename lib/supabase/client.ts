import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Used in Client Components and anywhere we need
 * the user's session from the browser.
 *
 * Keys are public by design — the publishable key is safe in the browser
 * bundle; RLS is what protects data.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
