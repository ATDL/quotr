import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recoverQuote } from "@/lib/quote-actions";

/**
 * /dashboard/deleted
 *
 * Soft-deleted quotes within their 30-day recovery window. PII is already
 * nulled — these rows show only the quote ID, the date deleted, and a
 * Recover button. After 30 days the cron job hard-purges them.
 */
export default async function DeletedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: deleted } = await supabase
    .from("quotes")
    .select("id, deleted_at, status")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const hasAny = (deleted?.length ?? 0) > 0;

  function daysLeft(deletedAt: string): number {
    const ms = 30 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(deletedAt).getTime();
    return Math.max(0, Math.ceil((ms - elapsed) / (24 * 60 * 60 * 1000)));
  }

  return (
    <div className="space-y-6">
      <header>
        <a
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-2 text-sm text-fog hover:text-chalk"
        >
          <span aria-hidden>←</span> Back to My jobs
        </a>
        <h1 className="text-3xl font-bold tracking-tight">
          Recently deleted
        </h1>
      </header>

      <div
        role="note"
        className="rounded-lg border border-white/10 bg-steel/60 px-4 py-3 text-sm text-fog"
      >
        Customer details have been wiped. Numeric values stay until the row
        is hard-purged 30 days after deletion. Recover restores the row but
        not the redacted fields.
      </div>

      {!hasAny && (
        <div className="rounded-xl border border-dashed border-white/15 bg-steel/40 p-8 text-center text-sm text-fog">
          Nothing in the recovery window.
        </div>
      )}

      {hasAny && (
        <ul className="space-y-2" role="list">
          {deleted!.map((q) => {
            const left = daysLeft(q.deleted_at!);
            return (
              <li
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-steel p-4"
              >
                <div className="min-w-0">
                  <div className="font-mono text-sm text-fog">
                    Quote …{q.id.slice(-8)}
                  </div>
                  <div className="text-xs text-fog">
                    {q.status === "closed" ? "Closed-out job" : "Open quote"}{" "}
                    · {left} day{left === 1 ? "" : "s"} until permanent
                    deletion
                  </div>
                </div>
                <form action={recoverQuote}>
                  <input type="hidden" name="quoteId" value={q.id} />
                  <button
                    type="submit"
                    className="rounded border border-white/15 px-3 py-1.5 text-xs text-fog transition hover:border-white/30 hover:text-chalk"
                  >
                    Recover
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
