"use client";

import { useEffect, useState } from "react";
import { formatPct, formatUSD } from "@/lib/utils/money";

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
  quotedTotalCents: number;
  actualTotalCents: number;
  profitCents: number;
  profitPct: number;
  variancePct: number;
  creditsLeft: number;
  isFirstCloseOut: boolean;
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
  variancePct,
  headline,
  takeaway,
  jobType,
}: {
  variancePct: number;
  headline: string;
  takeaway: string;
  jobType: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const sign = variancePct > 0 ? "+" : variancePct < 0 ? "−" : "";
    const pct = Math.abs(variancePct).toFixed(0);
    const text = [
      `Quotr close-out${jobType ? ` · ${jobType}` : ""}`,
      `${headline} ${sign}${pct}%`,
      takeaway,
      "https://quotr.app",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" onClick={onShare} className="btn-primary flex-1">
      {copied ? "Copied!" : "Share this"}
    </button>
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
