import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth guard for everything under /dashboard/*.
 * No user → bounce to /login. Also loads the user's credits balance once
 * and surfaces it in the nav via a Server Component.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("credits_balance, email")
    .eq("id", user.id)
    .single();

  const credits = profile?.credits_balance ?? 0;
  const email = profile?.email ?? user.email ?? "";

  return (
    <div className="min-h-screen bg-ink text-chalk">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a href="/dashboard" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-rust" aria-hidden />
            <span className="font-bold tracking-tight">Quotr</span>
          </a>

          <div className="flex items-center gap-5 text-sm">
            <a
              href="/dashboard"
              className="text-fog transition hover:text-chalk"
            >
              My jobs
            </a>
            <a
              href="/#calculator"
              className="text-fog transition hover:text-chalk"
            >
              New quote
            </a>
            <a
              href="/dashboard/credits"
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs"
              title={`${credits} close-out credits remaining`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-safety" aria-hidden />
              {credits} credit{credits === 1 ? "" : "s"}
            </a>
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="text-fog transition hover:text-chalk"
                title={email}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
