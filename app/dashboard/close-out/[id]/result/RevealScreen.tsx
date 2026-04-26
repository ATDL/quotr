"use client";

import { useEffect, useRef, useState } from "react";
import { formatPct, formatUSD } from "@/lib/utils/money";
import type { Badge } from "@/lib/badges";
import type { ActualLine, QuoteLine } from "@/lib/materials";
import {
  archiveQuote,
  deleteQuoteForever,
  undoCloseOut,
} from "@/lib/quote-actions";

type Props = {
  quoteId: string;
  customerName: string | null;
  scope: string | null;
  jobType: string | null;
  watchingFor: string | null;
  wasWatchingCorrect: boolean | null;
  surpriseNote: string | null;
  quotedHours: number;
  actualHours: number;
  quotedMaterialsCents: number;
  actualMaterialsCents: number;
  quotedLaborCents: number;
  actualLaborCents: number;
  quotedTotalCents: number;
  actualTotalCents: number;
  profitCents: number;
  profitPct: number;
  variancePct: number;
  creditsLeft: number;
  isFirstCloseOut: boolean;
  unlockedBadge: Badge | null;
  materialsItemized: boolean;
  quoteLines: QuoteLine[];
  actualLines: ActualLine[];
  canUndo: boolean;
  isArchived: boolean;
  deleteConfirmHint: string;
  msg: string | null;
};

type Heat = {
  color: "heat-max" | "heat-warn" | "heat-ok" | "heat-sandbag";
  headline: string;
  takeaway: string;
};

function heatScale(variance: number, varianceDollars: number): Heat {
  if (variance >= 20) {
    return {
      color: "heat-max",
      headline: "Big miss.",
      takeaway: `You under-quoted by ${formatPct(variance)}. The next one of these needs more buffer.`,
    };
  }
  if (variance >= 10) {
    return {
      color: "heat-warn",
      headline: "Under.",
      takeaway: `You under-quoted by ${formatPct(variance)}. Worth watching if this keeps happening.`,
    };
  }
  if (variance >= 3) {
    return {
      color: "heat-warn",
      headline: "Tight.",
      takeaway: "A little under. Close-out is earning its keep.",
    };
  }
  if (variance >= -3) {
    return {
      color: "heat-ok",
      headline: "Dead eye.",
      takeaway: "You called it. Within 3% of actual.",
    };
  }
  if (variance >= -10) {
    return {
      color: "heat-ok",
      headline: "Comfortable.",
      takeaway: `Quoted with room. You left ${formatUSD(Math.abs(varianceDollars))} on the table — or kept it as margin.`,
    };
  }
  return {
    color: "heat-sandbag",
    headline: "Sandbagged.",
    takeaway:
      "Quoted high and still won the job. Worth knowing for the next bid.",
  };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// ease-reveal = cubic-bezier(0.2, 0.8, 0.2, 1). For the RAF count-up we
// approximate with easeOutQuart, which has a similar "fast-to-settle" shape.
function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4);
}

function useCountUp(target: number, durationMs: number, enabled: boolean) {
  const [val, setVal] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setVal(target);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const progress = Math.min((t - start) / durationMs, 1);
      setVal(target * easeOutQuart(progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, enabled]);
  return val;
}

export default function RevealScreen(p: Props) {
  const reduced = usePrefersReducedMotion();
  const animate = !reduced;

  const varianceDollars = p.actualTotalCents - p.quotedTotalCents;
  const heat = heatScale(p.variancePct, varianceDollars);

  // Staggered reveal — purely CSS transitions so no Framer dep required.
  const [stage, setStage] = useState(animate ? 0 : 99);
  useEffect(() => {
    if (!animate) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // T+0     label
    timers.push(setTimeout(() => setStage(1), 0));
    // T+200   summary
    timers.push(setTimeout(() => setStage(2), 200));
    // T+400   headline
    timers.push(setTimeout(() => setStage(3), 400));
    // T+700   number starts counting (handled by useCountUp trigger)
    timers.push(setTimeout(() => setStage(4), 700));
    // T+2500  glow + takeaway
    timers.push(setTimeout(() => setStage(5), 2500));
    // T+3100  stat pills + were-you-right
    timers.push(setTimeout(() => setStage(6), 3100));
    // T+3580  actions
    timers.push(setTimeout(() => setStage(7), 3580));
    return () => timers.forEach(clearTimeout);
  }, [animate]);

  const countEnabled = animate && stage >= 4;
  const displayVariance = useCountUp(p.variancePct, 1800, countEnabled);

  // Badge modal opens after the reveal has fully played out. With reduced
  // motion we still wait briefly so the number registers before the modal.
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  useEffect(() => {
    if (!p.unlockedBadge) return;
    const delay = animate ? 3800 : 600;
    const t = setTimeout(() => setBadgeModalOpen(true), delay);
    return () => clearTimeout(t);
  }, [p.unlockedBadge, animate]);

  // Haptic buzz on count start. Safari ignores; acceptable.
  useEffect(() => {
    if (countEnabled && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(40);
      } catch {
        /* ignore */
      }
    }
  }, [countEnabled]);

  // Confetti on "Yes, called it".
  const showConfetti = p.wasWatchingCorrect === true;

  const sign = p.variancePct > 0 ? "+" : p.variancePct < 0 ? "−" : "";
  const absDisplay = Math.abs(displayVariance);

  // Heat colors: use arbitrary Tailwind classes so we don't need to pre-list.
  const numberColorClass =
    heat.color === "heat-max"
      ? "text-heat-max"
      : heat.color === "heat-warn"
      ? "text-heat-warn"
      : heat.color === "heat-ok"
      ? "text-heat-ok"
      : "text-heat-sandbag";

  const subtle = (s: number) => (animate && stage < s ? "opacity-0" : "opacity-100");
  const slideIn = (s: number) =>
    animate && stage < s ? "translate-y-3" : "translate-y-0";

  return (
    <div className="relative mx-auto max-w-[520px] space-y-6">
      {showConfetti && <Confetti />}

      <div className={`flex items-center justify-between transition-opacity duration-500 ease-reveal ${subtle(1)}`}>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-fog hover:text-chalk"
        >
          <span aria-hidden>←</span> Back to My jobs
        </a>
        <a
          href={`/dashboard/close-out/${p.quoteId}/edit`}
          className="text-sm text-fog hover:text-chalk"
        >
          Edit →
        </a>
      </div>

      <div className={`transition-opacity duration-500 ease-reveal ${subtle(1)}`}>
        <div className="text-xs uppercase tracking-wider text-fog">
          Close-out {p.jobType ? `· ${p.jobType} ` : ""}
          {p.customerName ? `· ${p.customerName}` : ""}
        </div>
        <p
          className={`mt-1 text-sm text-fog transition-opacity duration-500 ease-reveal ${subtle(2)}`}
        >
          Quoted {formatUSD(p.quotedTotalCents)} · Actual{" "}
          {formatUSD(p.actualTotalCents)}
        </p>
      </div>

      {/* The hero moment */}
      <div
        className={`text-center transition-all duration-500 ease-reveal ${subtle(3)} ${slideIn(3)}`}
      >
        <div className={`text-2xl font-bold tracking-tight ${numberColorClass}`}>
          {heat.headline}
        </div>
      </div>

      <div className="relative text-center">
        <div
          className={`pointer-events-none absolute inset-0 rounded-full transition-opacity duration-500 ease-reveal ${subtle(5)}`}
          style={{ boxShadow: "0 0 60px rgba(245, 165, 36, 0.35)" }}
          aria-hidden
        />
        <div
          className={`relative font-mono text-7xl font-extrabold leading-none md:text-8xl ${numberColorClass}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {animate && stage < 4 ? "—" : `${sign}${absDisplay.toFixed(0)}%`}
        </div>
      </div>

      <p
        className={`text-center text-base text-chalk transition-opacity duration-500 ease-reveal ${subtle(5)}`}
      >
        {heat.takeaway}
      </p>

      {/* Stat pills */}
      <div
        className={`grid grid-cols-3 gap-2 transition-opacity duration-500 ease-reveal ${subtle(6)}`}
      >
        <StatPill
          label="Profit"
          value={
            p.profitCents >= 0 ? `+${formatUSD(p.profitCents)}` : formatUSD(p.profitCents)
          }
          tone={p.profitCents >= 0 ? "good" : "bad"}
        />
        <StatPill
          label="Margin"
          value={formatPct(p.profitPct)}
          tone={p.profitPct >= 0 ? "good" : "bad"}
        />
        <StatPill label="Credits left" value={String(p.creditsLeft)} />
      </div>

      {/* Quoted-vs-actual breakdown — always shows labor/materials split,
          per-line when the user opted in to itemization. */}
      <div
        className={`transition-opacity duration-500 ease-reveal ${subtle(6)}`}
      >
        <QuotedVsActual
          quotedLaborCents={p.quotedLaborCents}
          actualLaborCents={p.actualLaborCents}
          quotedMaterialsCents={p.quotedMaterialsCents}
          actualMaterialsCents={p.actualMaterialsCents}
          itemized={p.materialsItemized}
          actualLines={p.actualLines}
        />
      </div>

      {/* Were-you-right result callout */}
      {p.watchingFor && p.wasWatchingCorrect !== null && (
        <div
          className={`rounded-lg border p-4 transition-opacity duration-500 ease-reveal ${subtle(6)} ${
            p.wasWatchingCorrect
              ? "border-moss/30 bg-moss/5"
              : "border-white/10 bg-steel"
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider text-fog">
            {p.wasWatchingCorrect
              ? "You called your surprise"
              : "Different surprise — still data"}
          </div>
          <p className="mt-1 text-sm italic text-chalk">
            &ldquo;{p.watchingFor}&rdquo;
          </p>
        </div>
      )}

      {p.surpriseNote && (
        <div
          className={`rounded-lg border border-white/10 bg-steel p-4 transition-opacity duration-500 ease-reveal ${subtle(6)}`}
        >
          <div className="text-[11px] uppercase tracking-wider text-fog">
            What actually surprised you
          </div>
          <p className="mt-2 text-sm italic text-chalk">
            &ldquo;{p.surpriseNote}&rdquo;
          </p>
        </div>
      )}

      {/* First-close-out flourish */}
      {p.isFirstCloseOut && (
        <div
          className={`rounded-xl border border-badge-gold/40 bg-badge-gold/5 p-5 transition-opacity duration-500 ease-reveal ${subtle(6)}`}
        >
          <div className="text-[11px] uppercase tracking-wider text-badge-gold">
            First close-out complete
          </div>
          <p className="mt-2 text-sm text-chalk">
            The feedback loop is live. Keep this going — a pack of 10 close-outs
            is $29, and one corrected quote usually pays for the pack.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/dashboard/credits" className="btn-primary text-sm">
              Grab a pack
            </a>
            <a href="/dashboard" className="btn-ghost text-sm">
              I&rsquo;ll think about it
            </a>
          </div>
        </div>
      )}

      {/* Actions */}
      <div
        className={`flex flex-wrap gap-3 transition-opacity duration-500 ease-reveal ${subtle(7)}`}
      >
        <ShareButton
          quoteId={p.quoteId}
          variancePct={p.variancePct}
          headline={heat.headline}
          takeaway={heat.takeaway}
          jobType={p.jobType}
        />
        <a href="/dashboard" className="btn-ghost flex-1">
          My jobs
        </a>
        <a href="/dashboard/new-quote" className="btn-ghost flex-1">
          New quote →
        </a>
      </div>

      <DangerZone
        quoteId={p.quoteId}
        canUndo={p.canUndo}
        isArchived={p.isArchived}
        deleteConfirmHint={p.deleteConfirmHint}
        msg={p.msg}
      />

      {p.unlockedBadge && badgeModalOpen && (
        <BadgeUnlockModal
          badge={p.unlockedBadge}
          animate={animate}
          onClose={() => setBadgeModalOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Always-on labor-vs-materials split. Shows per-line variance when the
 * close-out was itemized, plus an adaptive attribution callout when a
 * single line accounts for >60% of the materials variance.
 */
function QuotedVsActual({
  quotedLaborCents,
  actualLaborCents,
  quotedMaterialsCents,
  actualMaterialsCents,
  itemized,
  actualLines,
}: {
  quotedLaborCents: number;
  actualLaborCents: number;
  quotedMaterialsCents: number;
  actualMaterialsCents: number;
  itemized: boolean;
  actualLines: ActualLine[];
}) {
  const laborDelta = actualLaborCents - quotedLaborCents;
  const materialsDelta = actualMaterialsCents - quotedMaterialsCents;

  // Find the dominant materials line, if any, driving variance.
  let dominant: { name: string; delta: number } | null = null;
  let dominantShare = 0;
  if (itemized && Math.abs(materialsDelta) >= 500) {
    for (const l of actualLines) {
      const lineDelta = l.actual_cents - l.quoted_cents;
      if (Math.abs(lineDelta) > Math.abs(dominant?.delta ?? 0)) {
        dominant = {
          name: l.name || (l.new_at_closeout ? "Surprise line" : "A line"),
          delta: lineDelta,
        };
      }
    }
    if (dominant && materialsDelta !== 0) {
      dominantShare = Math.abs(dominant.delta / materialsDelta);
    }
  }

  const attribution =
    dominant && dominantShare >= 0.6 && Math.abs(dominant.delta) >= 500
      ? `Next time, check the ${dominant.name} price before you quote. It was ${Math.round(
          dominantShare * 100
        )}% of your materials variance here.`
      : itemized && Math.abs(materialsDelta) >= 500
      ? "Variance was spread across materials — not one specific line. The whole category needs a small buffer next time."
      : null;

  return (
    <div className="rounded-lg border border-white/10 bg-steel p-4">
      <div className="mb-3 text-[11px] uppercase tracking-wider text-fog">
        Quoted vs. actual
      </div>

      <SplitRow
        label="Labor"
        quoted={quotedLaborCents}
        actual={actualLaborCents}
        delta={laborDelta}
      />
      <SplitRow
        label="Materials"
        quoted={quotedMaterialsCents}
        actual={actualMaterialsCents}
        delta={materialsDelta}
      />

      {itemized && actualLines.length > 0 && (
        <details className="group mt-3 border-t border-white/10 pt-3">
          <summary className="cursor-pointer list-none text-xs text-fog hover:text-chalk">
            <span className="mr-2 group-open:hidden">▸</span>
            <span className="mr-2 hidden group-open:inline">▾</span>
            Where materials changed
          </summary>
          <ul className="mt-3 space-y-1.5" role="list">
            {actualLines.map((l) => {
              const delta = l.actual_cents - l.quoted_cents;
              const onTarget = Math.abs(delta) < 100 && !l.new_at_closeout;
              const name = l.name || "—";
              return (
                <li
                  key={l.id}
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 truncate text-fog">
                    {l.new_at_closeout && (
                      <span className="mr-1 text-heat-warn">✦</span>
                    )}
                    {name}
                  </span>
                  {onTarget ? (
                    <span className="shrink-0 text-xs text-fog">on target</span>
                  ) : (
                    <span
                      className={`shrink-0 font-mono text-xs ${
                        delta > 0
                          ? l.new_at_closeout
                            ? "text-heat-warn"
                            : "text-rust"
                          : "text-moss"
                      }`}
                    >
                      {delta > 0 ? "+" : ""}
                      {formatUSD(delta)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {attribution && (
        <div className="mt-3 rounded-md border border-safety/25 bg-safety/5 p-3 text-xs text-chalk">
          {attribution}
        </div>
      )}
    </div>
  );
}

function SplitRow({
  label,
  quoted,
  actual,
  delta,
}: {
  label: string;
  quoted: number;
  actual: number;
  delta: number;
}) {
  const deltaText =
    Math.abs(delta) < 100
      ? "on target"
      : `${delta > 0 ? "+" : ""}${formatUSD(delta)}`;
  const deltaClass =
    Math.abs(delta) < 100
      ? "text-fog"
      : delta > 0
      ? "text-rust"
      : "text-moss";
  return (
    <div className="flex items-baseline justify-between py-1.5 text-sm">
      <span className="text-fog">{label}</span>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-fog">
          {formatUSD(quoted)}
        </span>
        <span className="text-fog">→</span>
        <span className="font-mono text-chalk">{formatUSD(actual)}</span>
        <span className={`w-24 text-right font-mono text-xs ${deltaClass}`}>
          {deltaText}
        </span>
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const toneClass =
    tone === "good" ? "text-moss" : tone === "bad" ? "text-rust" : "text-chalk";
  return (
    <div className="rounded-lg border border-white/10 bg-steel px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-fog">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-sm font-semibold ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function ShareButton({
  quoteId,
  variancePct,
  headline,
  takeaway,
  jobType,
}: {
  quoteId: string;
  variancePct: number;
  headline: string;
  takeaway: string;
  jobType: string | null;
}) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    "idle"
  );

  async function onShare() {
    setState("working");
    try {
      const res = await fetch(`/api/share/${quoteId}`);
      if (!res.ok) throw new Error("image fetch failed");
      const blob = await res.blob();
      const file = new File([blob], "quotr-close-out.png", {
        type: "image/png",
      });

      // Prefer the native share sheet on mobile.
      const navAny = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
      };
      if (navAny.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Quotr close-out",
          text: `${headline} ${formatShareText(variancePct, takeaway, jobType)}`,
        });
        setState("done");
        setTimeout(() => setState("idle"), 2000);
        return;
      }

      // Desktop fallback: download.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quotr-close-out.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      // Text fallback — always works, no image required.
      try {
        await navigator.clipboard.writeText(
          formatShareText(variancePct, takeaway, jobType)
        );
        setState("done");
        setTimeout(() => setState("idle"), 2000);
      } catch {
        setState("error");
        setTimeout(() => setState("idle"), 2000);
      }
    }
  }

  const label =
    state === "working"
      ? "Preparing…"
      : state === "done"
      ? "Shared"
      : state === "error"
      ? "Try again"
      : "Share this";

  return (
    <button
      type="button"
      onClick={onShare}
      disabled={state === "working"}
      className="btn-primary flex-1"
    >
      {label}
    </button>
  );
}

function formatShareText(
  variancePct: number,
  takeaway: string,
  jobType: string | null
) {
  const sign = variancePct > 0 ? "+" : variancePct < 0 ? "−" : "";
  const pct = Math.abs(variancePct).toFixed(0);
  return [
    `Quotr close-out${jobType ? ` · ${jobType}` : ""}`,
    `${sign}${pct}% — ${takeaway}`,
    "https://quotr.app",
  ].join("\n");
}

function BadgeUnlockModal({
  badge,
  animate,
  onClose,
}: {
  badge: Badge;
  animate: boolean;
  onClose: () => void;
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Haptic: double-tap feels like an unlock.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([40, 60, 40]);
      } catch {
        /* ignore */
      }
    }
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-unlock-name"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-badge-gold/40 bg-steel p-6 text-center shadow-reveal"
      >
        <div className="relative mx-auto h-24 w-24">
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full border border-badge-gold/40 bg-badge-gold/10 text-3xl text-badge-gold ${
              animate ? "badge-pop" : ""
            }`}
            aria-hidden
          >
            {badge.icon}
          </div>
          {animate && (
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
              aria-hidden
            >
              <div className="badge-shimmer absolute inset-y-0 -left-full w-full" />
            </div>
          )}
        </div>

        <div className="mt-4 text-[11px] uppercase tracking-wider text-badge-gold">
          Milestone unlocked
        </div>
        <h2
          id="badge-unlock-name"
          className="mt-1 text-xl font-bold tracking-tight"
        >
          {badge.name}
        </h2>
        <p className="mt-2 text-sm text-fog">{badge.copy}</p>

        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          className="btn-primary mt-6 w-full"
        >
          Nice
        </button>
      </div>

      <style jsx>{`
        @keyframes badge-pop-kf {
          0% {
            transform: scale(0);
          }
          60% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }
        .badge-pop {
          animation: badge-pop-kf 500ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes badge-shimmer-kf {
          0% {
            transform: translateX(0);
            opacity: 0;
          }
          50% {
            opacity: 0.9;
          }
          100% {
            transform: translateX(300%);
            opacity: 0;
          }
        }
        .badge-shimmer {
          background: linear-gradient(
            100deg,
            transparent 0%,
            rgba(212, 165, 116, 0.6) 45%,
            rgba(255, 255, 255, 0.8) 50%,
            rgba(212, 165, 116, 0.6) 55%,
            transparent 100%
          );
          animation: badge-shimmer-kf 1200ms cubic-bezier(0.2, 0.8, 0.2, 1)
            200ms both;
        }
        @media (prefers-reduced-motion: reduce) {
          .badge-pop,
          .badge-shimmer {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Danger zone — archive (one tap), undo close-out (5-min window),
 * delete forever (two-stage modal). Lives below the main actions so it
 * doesn't compete with the share/new-quote CTAs.
 */
function DangerZone({
  quoteId,
  canUndo,
  isArchived,
  deleteConfirmHint,
  msg,
}: {
  quoteId: string;
  canUndo: boolean;
  isArchived: boolean;
  deleteConfirmHint: string;
  msg: string | null;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Re-open the delete modal automatically if we round-tripped with a
  // mismatch error so the user keeps their place in the flow.
  useEffect(() => {
    if (msg === "delete_mismatch") setDeleteOpen(true);
  }, [msg]);

  const inlineNote =
    msg === "undo_expired"
      ? "Undo window has passed. Use Delete forever instead — credit not refunded."
      : msg === "undo_rate_limited"
      ? "You already used your undo this month. Use Delete forever — credit not refunded."
      : msg === "delete_mismatch"
      ? "Confirmation didn't match. Try again."
      : null;

  return (
    <div className="rounded-lg border border-white/5 bg-steel/40 p-4">
      <div className="text-[11px] uppercase tracking-wider text-fog">
        Quote actions
      </div>

      {inlineNote && (
        <p className="mt-2 text-xs text-rust" role="status" aria-live="polite">
          {inlineNote}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {canUndo && (
          <form action={undoCloseOut}>
            <input type="hidden" name="quoteId" value={quoteId} />
            <button
              type="submit"
              className="rounded border border-white/15 px-3 py-2 text-xs text-fog transition hover:border-white/30 hover:text-chalk"
              title="Refunds 1 credit and re-opens the quote"
            >
              ⟲ Undo close-out
            </button>
          </form>
        )}

        {!isArchived && (
          <form action={archiveQuote}>
            <input type="hidden" name="quoteId" value={quoteId} />
            <input
              type="hidden"
              name="returnTo"
              value="/dashboard"
            />
            <button
              type="submit"
              className="rounded border border-white/15 px-3 py-2 text-xs text-fog transition hover:border-white/30 hover:text-chalk"
              title="Hides from active list. Stats unchanged."
            >
              Archive
            </button>
          </form>
        )}

        {isArchived && (
          <span className="rounded border border-white/10 bg-white/5 px-3 py-2 text-xs text-fog">
            Archived · still counted in stats
          </span>
        )}

        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="rounded border border-rust/30 px-3 py-2 text-xs text-rust transition hover:border-rust hover:bg-rust/10"
        >
          🗑 Delete forever
        </button>
      </div>

      {deleteOpen && (
        <DeleteForeverDialog
          quoteId={quoteId}
          confirmHint={deleteConfirmHint}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Two-stage delete-forever modal:
 *   Stage 1: warning + "Archive instead" (filled, primary) vs "Continue" (ghost)
 *   Stage 2: type-to-confirm using customer_name (or last 4 of UUID)
 *
 * Server-side enforcement is in deleteQuoteForever — this UI is the deliberate
 * friction that prevents misclicks, not a security boundary.
 */
function DeleteForeverDialog({
  quoteId,
  confirmHint,
  onClose,
}: {
  quoteId: string;
  confirmHint: string;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (stage === 2) inputRef.current?.focus();
    else continueRef.current?.focus();
  }, [stage]);

  const matches =
    typed.trim().toLowerCase() === confirmHint.trim().toLowerCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-rust/30 bg-steel p-6"
      >
        {stage === 1 ? (
          <>
            <h2
              id="delete-dialog-title"
              className="text-xl font-bold tracking-tight"
            >
              Delete this quote forever?
            </h2>
            <p className="mt-3 text-sm text-fog">
              This removes the customer details immediately and erases the
              quote completely after 30 days.
            </p>
            <div className="mt-3 rounded-md border border-white/10 bg-ink p-3 text-xs text-fog">
              <p className="font-semibold text-chalk">
                If this was a closed-out job, your stats will change.
              </p>
              <p className="mt-1">
                The variance from this close-out won&rsquo;t count toward your
                Accuracy score or calibration.
              </p>
            </div>
            <p className="mt-3 text-sm text-fog">
              If you just want it out of your active list,{" "}
              <span className="text-chalk">archive instead</span> — that keeps
              your stats honest.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={continueRef}
                type="button"
                onClick={() => setStage(2)}
                className="rounded border border-white/15 px-4 py-2 text-sm text-fog hover:border-white/30 hover:text-chalk"
              >
                Continue →
              </button>
              <form action={archiveQuote} className="flex">
                <input type="hidden" name="quoteId" value={quoteId} />
                <input type="hidden" name="returnTo" value="/dashboard" />
                <button type="submit" className="btn-primary w-full sm:w-auto">
                  Archive instead
                </button>
              </form>
            </div>
          </>
        ) : (
          <form action={deleteQuoteForever} className="space-y-4">
            <h2
              id="delete-dialog-title"
              className="text-xl font-bold tracking-tight"
            >
              Type to confirm
            </h2>
            <p className="text-sm text-fog">
              To confirm permanent deletion, type:
            </p>
            <p className="rounded border border-white/10 bg-ink px-3 py-2 font-mono text-sm">
              {confirmHint}
            </p>
            <input type="hidden" name="quoteId" value={quoteId} />
            <input
              ref={inputRef}
              name="confirmation"
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="Type customer name to confirm"
              aria-describedby="delete-confirm-status"
            />
            <p
              id="delete-confirm-status"
              aria-live="polite"
              className={`text-xs ${matches ? "text-moss" : "text-fog"}`}
            >
              {typed
                ? matches
                  ? "Match. Delete enabled."
                  : "Doesn't match yet."
                : ""}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-white/15 px-4 py-2 text-sm text-fog hover:border-white/30 hover:text-chalk"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!matches}
                className="rounded border border-rust bg-rust px-4 py-2 text-sm font-semibold text-white transition hover:bg-rust/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete forever
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Simple CSS-based confetti. Respects prefers-reduced-motion by rendering
// nothing when reduced is true (parent passes showConfetti=false in that case).
function Confetti() {
  // 28 pieces, randomized on mount. Fall + rotate over ~1.2s then fade.
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 200,
    rotate: Math.random() * 360,
    color: ["#F5A524", "#3FA373", "#D4A574", "#C55B2E"][i % 4],
    size: 6 + Math.random() * 6,
  }));
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 overflow-hidden"
      aria-hidden
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute block animate-[confetti_1200ms_ease-out_forwards]"
          style={{
            left: `${p.left}%`,
            top: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(200px) rotate(540deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
