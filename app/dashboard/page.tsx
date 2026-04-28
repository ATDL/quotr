import { createClient } from "@/lib/supabase/server";
import { formatPct, formatUSD } from "@/lib/utils/money";
import {
  BADGES,
  BADGE_ORDER,
  computeUnlocked,
  type BadgeId,
} from "@/lib/badges";

/**
 * My Jobs — the feedback loop, made visible.
 * Reads from the my_jobs_feed view (RLS restricts to the caller's rows).
 */
export default async function DashboardHome({
  searchParams,
}: {
  searchParams: { msg?: string };
}) {
  const supabase = createClient();

  const feedSelect =
    "close_out_id, quote_id, customer_name, scope, quoted_total_cents, actual_total_cents, computed_profit_cents, computed_profit_pct, computed_variance_pct, job_type, was_watching_correct, closed_at";

  // STATS feed — archived close-outs still count toward Accuracy + variance
  // per spec; only deleted rows drop out.
  const { data: jobsForStats } = await supabase
    .from("my_jobs_feed")
    .select(feedSelect)
    .is("quote_deleted_at", null)
    .is("close_out_deleted_at", null)
    .order("closed_at", { ascending: false });

  // DISPLAY feed — hides archived AND deleted from the active list/table.
  const { data: jobs } = await supabase
    .from("my_jobs_feed")
    .select(feedSelect)
    .is("quote_archived_at", null)
    .is("quote_deleted_at", null)
    .is("close_out_archived_at", null)
    .is("close_out_deleted_at", null)
    .order("closed_at", { ascending: false })
    .limit(25);

  const { data: openQuotes } = await supabase
    .from("quotes")
    .select("id, customer_name, scope, quoted_total_cents, created_at")
    .eq("status", "open")
    .is("archived_at", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  const unlockedBadges = computeUnlocked(jobsForStats ?? []);

  const hasJobs = (jobs?.length ?? 0) > 0;
  const hasOpen = (openQuotes?.length ?? 0) > 0;

  const banner = bannerForMsg(searchParams.msg);

  return (
    <div className="space-y-10">
      {banner && <ActionBanner tone={banner.tone}>{banner.text}</ActionBanner>}
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
          <div className="space-y-6">
            <AccuracyRow jobs={jobsForStats ?? jobs!} />
            <LastJobCard job={jobs![0]} />
            <MilestonesStrip unlocked={unlockedBadges} />
            <SummaryBar jobs={jobsForStats ?? jobs!} />
            <ByJobTypeCard jobs={jobsForStats ?? jobs!} />
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-steel text-left text-xs uppercase tracking-wider text-fog">
                  <tr>
                    <th className="px-4 py-3">Job</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Quoted</th>
                    <th className="px-4 py-3 text-right">Actual</th>
                    <th className="px-4 py-3 text-right">Profit</th>
                    <th className="px-4 py-3 text-right">Margin</th>
                    <th className="px-4 py-3 text-right">Variance</th>
                    <th className="px-2 py-3"></th>
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
                      <td className="px-4 py-3 text-fog">
                        {j.job_type || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatUSD(j.quoted_total_cents)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatUSD(j.actual_total_cents)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono ${
                          j.computed_profit_cents < 0
                            ? "text-rust"
                            : "text-moss"
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
                      <td
                        className={`px-4 py-3 text-right font-mono ${
                          j.computed_variance_pct > 5
                            ? "text-rust"
                            : j.computed_variance_pct < -5
                            ? "text-moss"
                            : "text-fog"
                        }`}
                      >
                        {j.computed_variance_pct > 0 ? "+" : ""}
                        {formatPct(j.computed_variance_pct)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <a
                          href={`/dashboard/close-out/${j.quote_id}/result`}
                          className="text-fog transition hover:text-chalk"
                          aria-label="View result"
                        >
                          →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

type Job = {
  computed_profit_cents: number;
  computed_profit_pct: number;
  quoted_total_cents: number;
  actual_total_cents: number;
  close_out_id: string;
  quote_id: string;
  customer_name: string | null;
  scope: string | null;
  computed_variance_pct: number;
  job_type: string | null;
  was_watching_correct?: boolean | null;
  closed_at: string;
};

function LastJobCard({ job }: { job: Job }) {
  const profitGood = job.computed_profit_cents >= 0;
  const varianceBad = job.computed_variance_pct > 5;
  const varianceGood = job.computed_variance_pct < -5;

  return (
    <a
      href={`/dashboard/close-out/${job.quote_id}/result`}
      className={`block rounded-xl border p-5 transition hover:border-white/25 ${
        profitGood
          ? "border-moss/30 bg-moss/5"
          : "border-rust/40 bg-rust/5"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-fog">
          Your last job
        </span>
        <span className="text-xs text-fog">View result →</span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate font-semibold">
            {job.customer_name || "Unnamed customer"}
          </div>
          <div className="truncate text-sm text-fog">
            {job.scope || job.job_type || "No scope"}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`font-mono text-2xl font-bold ${
              profitGood ? "text-moss" : "text-rust"
            }`}
          >
            {profitGood ? "+" : ""}
            {formatUSD(job.computed_profit_cents)}
          </div>
          <div className="mt-0.5 font-mono text-xs text-fog">
            {formatPct(job.computed_profit_pct)} margin ·{" "}
            <span
              className={
                varianceBad
                  ? "text-rust"
                  : varianceGood
                  ? "text-moss"
                  : "text-fog"
              }
            >
              {job.computed_variance_pct > 0 ? "+" : ""}
              {formatPct(job.computed_variance_pct)} vs. quote
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

function SummaryBar({ jobs }: { jobs: Job[] }) {
  const totalProfit = jobs.reduce((s, j) => s + j.computed_profit_cents, 0);
  const margins = jobs
    .map((j) => j.computed_profit_pct)
    .filter(Number.isFinite);
  const variances = jobs
    .map((j) => j.computed_variance_pct)
    .filter(Number.isFinite);
  const avgMargin =
    margins.length > 0
      ? margins.reduce((s, m) => s + m, 0) / margins.length
      : null;
  const avgVariance =
    variances.length > 0
      ? variances.reduce((s, v) => s + v, 0) / variances.length
      : null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Jobs closed" value={String(jobs.length)} />
      <Stat
        label="Total profit"
        value={formatUSD(totalProfit)}
        tone={totalProfit < 0 ? "bad" : "good"}
      />
      <Stat
        label="Avg margin"
        value={avgMargin !== null ? formatPct(avgMargin) : "—"}
        tone={
          avgMargin === null ? undefined : avgMargin < 0 ? "bad" : "good"
        }
      />
      <Stat
        label="Avg variance"
        value={
          avgVariance !== null
            ? `${avgVariance > 0 ? "+" : ""}${formatPct(avgVariance)}`
            : "—"
        }
        tone={
          avgVariance === null
            ? undefined
            : avgVariance > 5
            ? "bad"
            : avgVariance < -5
            ? "good"
            : undefined
        }
        hint={
          avgVariance !== null && avgVariance > 10
            ? "You're underbidding on average — pad future quotes."
            : undefined
        }
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  hint?: string;
}) {
  const toneClass =
    tone === "bad" ? "text-rust" : tone === "good" ? "text-moss" : "text-chalk";
  return (
    <div className="rounded-lg border border-white/10 bg-steel px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-fog">
        {label}
      </div>
      <div className={`mt-1 font-mono text-xl font-bold ${toneClass}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-rust">{hint}</div>}
    </div>
  );
}

function ByJobTypeCard({ jobs }: { jobs: Job[] }) {
  const typed = jobs.filter((j) => !!j.job_type);
  if (typed.length < 2) return null;

  type Bucket = { count: number; totalProfit: number; margins: number[] };
  const byType = new Map<string, Bucket>();

  for (const j of typed) {
    const existing = byType.get(j.job_type!) ?? {
      count: 0,
      totalProfit: 0,
      margins: [],
    };
    existing.count += 1;
    existing.totalProfit += j.computed_profit_cents;
    if (Number.isFinite(j.computed_profit_pct)) {
      existing.margins.push(j.computed_profit_pct);
    }
    byType.set(j.job_type!, existing);
  }

  const rows = Array.from(byType.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([type, v]) => ({
      type,
      count: v.count,
      totalProfit: v.totalProfit,
      avgMargin:
        v.margins.length > 0
          ? v.margins.reduce((s, m) => s + m, 0) / v.margins.length
          : null,
    }))
    .sort((a, b) => b.totalProfit - a.totalProfit);

  if (rows.length === 0) return null;

  return (
    <section>
      <h3 className="mb-3 text-xs uppercase tracking-wider text-fog">
        Profit by job type
      </h3>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map((r) => {
          const profitBad = r.totalProfit < 0;
          const marginBad = r.avgMargin !== null && r.avgMargin < 0;
          return (
            <div
              key={r.type}
              className="rounded-lg border border-white/10 bg-steel px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{r.type}</div>
                  <div className="text-xs text-fog">
                    {r.count} jobs closed
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-mono text-lg font-bold ${
                      profitBad ? "text-rust" : "text-moss"
                    }`}
                  >
                    {formatUSD(r.totalProfit)}
                  </div>
                  <div
                    className={`font-mono text-xs ${
                      marginBad ? "text-rust" : "text-moss"
                    }`}
                  >
                    {r.avgMargin !== null ? formatPct(r.avgMargin) : "—"} avg
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-fog">
        After 5+ jobs of a type, you can trust this signal. Consider dropping
        types that stay red.
      </p>
    </section>
  );
}

/**
 * Milestones strip — badges computed from the user's close-outs, shown
 * unlocked (gold) or locked (monochrome with hint). Hints are informational,
 * not nags — spec requires no shame copy.
 */
function MilestonesStrip({ unlocked }: { unlocked: Set<BadgeId> }) {
  return (
    <section>
      <h3 className="mb-3 text-xs uppercase tracking-wider text-fog">
        Milestones
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {BADGE_ORDER.map((id) => {
          const badge = BADGES[id];
          const isUnlocked = unlocked.has(id);
          return (
            <div
              key={id}
              className={`group relative flex min-w-[160px] shrink-0 flex-col items-center rounded-lg border px-3 py-4 text-center transition ${
                isUnlocked
                  ? "border-badge-gold/40 bg-badge-gold/5"
                  : "border-white/10 bg-steel/50"
              }`}
              title={isUnlocked ? badge.copy : badge.hint}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg ${
                  isUnlocked
                    ? "border-badge-gold/50 bg-badge-gold/10 text-badge-gold"
                    : "border-white/10 bg-white/5 text-fog"
                }`}
                aria-hidden
              >
                {isUnlocked ? badge.icon : "—"}
              </div>
              <div
                className={`mt-2 text-xs font-semibold ${
                  isUnlocked ? "text-chalk" : "text-fog"
                }`}
              >
                {badge.name}
              </div>
              <div className="mt-1 text-[10px] leading-snug text-fog">
                {isUnlocked ? "Unlocked" : badge.hint}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Accuracy row = the self-reward scoreboard.
 *
 * Formula: accuracy = clamp(100 - (avg_abs_variance * 2), 0, 100) over the
 * user's last 10 close-outs. Single number that goes up as they close out
 * more accurately — the "my number's rising" signal.
 */
function AccuracyRow({ jobs }: { jobs: Job[] }) {
  const last = jobs.slice(0, 10);
  const abs = last
    .map((j) => Math.abs(j.computed_variance_pct))
    .filter(Number.isFinite);
  const score =
    abs.length >= 3
      ? Math.max(
          0,
          Math.min(100, Math.round(100 - (abs.reduce((s, v) => s + v, 0) / abs.length) * 2))
        )
      : null;

  // Streak = consecutive most-recent close-outs within ±10% variance.
  let streak = 0;
  for (const j of jobs) {
    if (Math.abs(j.computed_variance_pct) <= 10) streak++;
    else break;
  }

  return (
    <div className="grid gap-3 md:grid-cols-[auto_1fr]">
      <AccuracyDial score={score} sampleCount={last.length} />
      <StreakBanner streak={streak} />
    </div>
  );
}

function AccuracyDial({
  score,
  sampleCount,
}: {
  score: number | null;
  sampleCount: number;
}) {
  const size = 160;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = score ?? 0;
  const dash = (pct / 100) * circumference;

  const label =
    score === null
      ? sampleCount === 0
        ? "Close out 3 jobs to see your accuracy"
        : `First ${sampleCount} data point${sampleCount === 1 ? "" : "s"} in`
      : score >= 90
      ? "Dialed in"
      : score >= 75
      ? "Getting sharper"
      : score >= 60
      ? "Finding your range"
      : score >= 40
      ? "Early days — keep closing out"
      : "Noisy — trust the data, not the gut";

  const stroke_color =
    score === null
      ? "#374151"
      : score >= 75
      ? "#3FA373"
      : score >= 40
      ? "#E07A3A"
      : "#F5A524";

  return (
    <div
      className="flex items-center gap-4 rounded-xl border border-white/10 bg-steel p-5"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score ?? 0}
      aria-label="Quote accuracy score"
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={stroke_color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: "stroke-dasharray 800ms cubic-bezier(0.2,0.8,0.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-4xl font-bold">
            {score === null ? "—" : score}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-fog">
            Accuracy
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-fog">
          Quote accuracy
        </div>
        <div className="mt-1 text-lg font-semibold">{label}</div>
        <div className="mt-1 text-xs text-fog">
          Based on your last {Math.min(sampleCount, 10)} close-out
          {sampleCount === 1 ? "" : "s"}. Score rises as your actual totals
          track closer to what you quoted.
        </div>
      </div>
    </div>
  );
}

function StreakBanner({ streak }: { streak: number }) {
  if (streak === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-steel/40 p-5">
        <div className="text-[11px] uppercase tracking-wider text-fog">
          Accuracy streak
        </div>
        <div className="mt-1 text-sm text-fog">
          Close out a job within ±10% of quote to start a streak.
        </div>
      </div>
    );
  }

  // Only emoji in the whole app, intentional per the Hooked spec.
  const label =
    streak >= 5
      ? `${streak} in a row 🔥 — dialed in`
      : streak === 3 || streak === 4
      ? `${streak} in a row 🔥`
      : streak === 2
      ? "2 in a row — getting a feel for it"
      : "Starting a streak — 1 accurate quote";

  return (
    <div
      className="rounded-xl border border-moss/30 bg-moss/5 p-5"
      aria-label={`Accuracy streak: ${streak}`}
    >
      <div className="text-[11px] uppercase tracking-wider text-fog">
        Accuracy streak
      </div>
      <div className="mt-1 text-lg font-semibold text-chalk">{label}</div>
      <div className="mt-1 text-xs text-fog">
        Counts consecutive close-outs inside ±10%. Slips silently reset — no
        streak-lost guilt here.
      </div>
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
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
        <a href="/dashboard/new-quote" className="btn-primary inline-flex">
          Start a quote →
        </a>
        <a href="/dashboard/archived" className="text-fog hover:text-chalk">
          View archived
        </a>
      </div>
    </div>
  );
}

function bannerForMsg(
  msg: string | undefined
): { tone: "ok" | "warn"; text: string } | null {
  switch (msg) {
    case "archived":
      return { tone: "ok", text: "Archived. Stats unchanged." };
    case "restored":
      return { tone: "ok", text: "Restored to your active list." };
    case "deleted":
      return {
        tone: "warn",
        text: "Deleted. Recover within 30 days from /dashboard/deleted.",
      };
    case "recovered":
      return { tone: "ok", text: "Recovered. Customer details stay blank." };
    case "undone":
      return { tone: "ok", text: "Close-out undone. Credit refunded." };
    case "undo_expired":
      return {
        tone: "warn",
        text: "Undo window has passed. Use Delete forever instead — that won't refund the credit.",
      };
    case "undo_rate_limited":
      return {
        tone: "warn",
        text: "You already used your undo this month. Use Delete forever — note: that won't refund the credit.",
      };
    case "undo_not_found":
      return { tone: "warn", text: "Couldn't find that close-out to undo." };
    case "delete_mismatch":
      return {
        tone: "warn",
        text: "Confirmation didn't match. Nothing was deleted.",
      };
    case "result_quote_missing":
      return {
        tone: "warn",
        text: "Couldn't find that quote. It may have been deleted, or your session is stale — try signing out and back in.",
      };
    case "result_closeout_missing":
      return {
        tone: "warn",
        text: "Quote exists but its close-out row is missing. Check Supabase: select * from close_outs where quote_id = '<id from URL>'.",
      };
    case "result_quote_deleted":
      return {
        tone: "warn",
        text: "That quote was deleted. Recover it from Recently deleted (footer) within 30 days.",
      };
    default:
      return null;
  }
}

function ActionBanner({
  tone,
  children,
}: {
  tone: "ok" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-moss/30 bg-moss/5 text-chalk"
      : "border-rust/40 bg-rust/5 text-chalk";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border ${cls} px-4 py-3 text-sm`}
    >
      {children}
    </div>
  );
}
