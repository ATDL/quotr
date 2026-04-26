import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPct, formatUSD } from "@/lib/utils/money";
import { restoreQuote } from "@/lib/quote-actions";

/**
 * /dashboard/archived
 *
 * Lists quotes the user has archived. Archive is the soft-hide tier — these
 * still count toward stats. From here the user can restore (one tap) or
 * walk through delete-forever from the result page if they want it gone.
 */
export default async function ArchivedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Open quotes the user archived before closing out.
  const { data: archivedOpen } = await supabase
    .from("quotes")
    .select("id, customer_name, scope, quoted_total_cents, archived_at, status")
    .not("archived_at", "is", null)
    .is("deleted_at", null)
    .eq("status", "open")
    .order("archived_at", { ascending: false });

  // Close-outs whose underlying quote is archived (or the close-out itself is).
  const { data: archivedClosed } = await supabase
    .from("my_jobs_feed")
    .select(
      "close_out_id, quote_id, customer_name, scope, quoted_total_cents, computed_profit_cents, computed_profit_pct, computed_variance_pct, job_type, closed_at, quote_archived_at, close_out_archived_at"
    )
    .or(
      "quote_archived_at.not.is.null,close_out_archived_at.not.is.null"
    )
    .is("quote_deleted_at", null)
    .is("close_out_deleted_at", null)
    .order("closed_at", { ascending: false });

  const hasAny =
    (archivedOpen?.length ?? 0) > 0 || (archivedClosed?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <header>
        <a
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-2 text-sm text-fog hover:text-chalk"
        >
          <span aria-hidden>←</span> Back to My jobs
        </a>
        <h1 className="text-3xl font-bold tracking-tight">Archived</h1>
      </header>

      <div
        role="note"
        className="rounded-lg border border-white/10 bg-steel/60 px-4 py-3 text-sm text-fog"
      >
        These don&rsquo;t appear in your active list, but they still count in
        your stats. Restore any time — or use Delete forever from the result
        page if you want them gone.
      </div>

      {!hasAny && (
        <div className="rounded-xl border border-dashed border-white/15 bg-steel/40 p-8 text-center text-sm text-fog">
          Nothing archived.
        </div>
      )}

      {(archivedClosed?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-wider text-fog">
            Closed jobs
          </h2>
          <ul className="space-y-2" role="list">
            {archivedClosed!.map((j) => (
              <li
                key={j.close_out_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-steel p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {j.customer_name || "Unnamed customer"}
                  </div>
                  <div className="text-xs text-fog">
                    {j.scope || j.job_type || "No scope"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`font-mono text-sm ${
                      j.computed_profit_cents < 0 ? "text-rust" : "text-moss"
                    }`}
                  >
                    {formatUSD(j.computed_profit_cents)} ·{" "}
                    {formatPct(j.computed_profit_pct)}
                  </span>
                  <a
                    href={`/dashboard/close-out/${j.quote_id}/result`}
                    className="text-xs text-fog underline-offset-2 hover:text-chalk hover:underline"
                  >
                    View
                  </a>
                  <form action={restoreQuote}>
                    <input type="hidden" name="quoteId" value={j.quote_id} />
                    <button
                      type="submit"
                      className="rounded border border-white/15 px-3 py-1.5 text-xs text-fog transition hover:border-white/30 hover:text-chalk"
                    >
                      Restore
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(archivedOpen?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-wider text-fog">
            Open quotes
          </h2>
          <ul className="space-y-2" role="list">
            {archivedOpen!.map((q) => (
              <li
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-steel p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {q.customer_name || "Unnamed customer"}
                  </div>
                  <div className="text-xs text-fog">
                    {q.scope || "No scope on file"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">
                    {formatUSD(q.quoted_total_cents)}
                  </span>
                  <form action={restoreQuote}>
                    <input type="hidden" name="quoteId" value={q.id} />
                    <button
                      type="submit"
                      className="rounded border border-white/15 px-3 py-1.5 text-xs text-fog transition hover:border-white/30 hover:text-chalk"
                    >
                      Restore
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
