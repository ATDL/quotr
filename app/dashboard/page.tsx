import { createClient } from "@/lib/supabase/server";
import { formatPct, formatUSD } from "@/lib/utils/money";

/**
 * My Jobs — the feedback loop, made visible.
 * Reads from the my_jobs_feed view (RLS restricts to the caller's rows).
 */
export default async function DashboardHome() {
  const supabase = createClient();

  const { data: jobs } = await supabase
    .from("my_jobs_feed")
    .select(
      "close_out_id, quote_id, customer_name, scope, quoted_total_cents, actual_total_cents, computed_profit_cents, computed_profit_pct, computed_variance_pct, job_type, closed_at"
    )
    .order("closed_at", { ascending: false })
    .limit(25);

  const { data: openQuotes } = await supabase
    .from("quotes")
    .select("id, customer_name, scope, quoted_total_cents, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(10);

  const hasJobs = (jobs?.length ?? 0) > 0;
  const hasOpen = (openQuotes?.length ?? 0) > 0;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">My jobs</h1>
        <p className="mt-1 text-sm text-fog">
          Every quote you close out shows up here — quoted vs. actual, profit,
          variance. The feedback loop that was missing.
        </p>
      </header>

      {hasOpen && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-wider text-fog">
            Open quotes
          </h2>
          <div className="space-y-2">
            {openQuotes!.map((q) => (
              <a
                key={q.id}
                href={`/dashboard/close-out/${q.id}`}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-steel p-4 transition hover:border-rust/40"
              >
                <div>
                  <div className="font-semibold">
                    {q.customer_name || "Unnamed customer"}
                  </div>
                  <div className="text-sm text-fog">
                    {q.scope || "No scope on file"}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-lg">
                    {formatUSD(q.quoted_total_cents)}
                  </span>
                  <span className="rounded-full bg-rust/20 px-3 py-1 text-xs text-rust">
                    Close out →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wider text-fog">
          Closed jobs
        </h2>

        {!hasJobs ? (
          <EmptyState />
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-steel text-left text-xs uppercase tracking-wider text-fog">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Quoted</th>
                  <th className="px-4 py-3 text-right">Actual</th>
                  <th className="px-4 py-3 text-right">Profit</th>
                  <th className="px-4 py-3 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {jobs!.map((j) => (
                  <tr
                    key={j.close_out_id}
                    className="border-t border-white/5 transition hover:bg-white/5"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold">
                        {j.customer_name || "—"}
                      </div>
                      <div className="text-xs text-fog">
                        {j.scope || "No scope"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fog">{j.job_type || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatUSD(j.quoted_total_cents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatUSD(j.actual_total_cents)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        j.computed_profit_cents < 0 ? "text-rust" : "text-moss"
                      }`}
                    >
                      {formatUSD(j.computed_profit_cents)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        j.computed_profit_pct < 0 ? "text-rust" : "text-moss"
                      }`}
                    >
                      {formatPct(j.computed_profit_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-steel/40 p-10 text-center">
      <h3 className="text-lg font-semibold">No closed jobs yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-fog">
        Quote a job on the calculator, save it, and when the job&rsquo;s done
        punch in your actual hours and materials. You&rsquo;ll see quoted vs.
        actual, profit, and variance right here.
      </p>
      <a href="/#calculator" className="btn-primary mt-6 inline-flex">
        Start a quote →
      </a>
    </div>
  );
}
