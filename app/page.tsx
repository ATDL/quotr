import Calculator from "@/components/Calculator";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-16">
      <Header />
      <Hero />
      <div className="mt-10">
        <Calculator />
      </div>
      <HowItWorks />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="mb-12 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded bg-rust" aria-hidden />
        <span className="text-lg font-bold tracking-tight">Quotr</span>
      </div>
      <nav className="flex items-center gap-1 text-sm text-fog">
        <a
          href="#pricing"
          className="rounded px-2 py-1 transition hover:bg-white/5 hover:text-chalk"
        >
          Pricing
        </a>
        <a
          href="#faq"
          className="rounded px-2 py-1 transition hover:bg-white/5 hover:text-chalk"
        >
          FAQ
        </a>
        <a
          href="/login"
          className="rounded px-2 py-1 transition hover:bg-white/5 hover:text-chalk"
        >
          Sign in
        </a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section>
      <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
        You quote by gut.
        <br />
        <span className="text-safety">You never find out if you were right.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-fog">
        Free calculator for your next quote. Close the job out when it&rsquo;s done and
        Quotr shows you quoted vs. actual, profit dollars, and profit percent — so the
        next quote isn&rsquo;t another guess.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a href="#calculator" className="btn-primary">
          Start a free quote →
        </a>
        <span className="text-sm text-fog">
          No credit card. No account needed to quote.
        </span>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="mt-20">
      <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <StepCard
          num="1"
          title="Quote it"
          body="Type in hours, materials, hourly rate. Quotr spits out a number you can give the customer in under 60 seconds."
          note="Free. No account."
          noteTone="moss"
        />
        <StepCard
          num="2"
          title="Close it out"
          body={
            <>
              Job&rsquo;s done? Punch in actual hours and actual material cost.
              Add a one-line &ldquo;what surprised me.&rdquo; Quotr compares
              quote to reality and shows profit.
            </>
          }
          note="One credit per close-out. First one on us."
          noteTone="safety"
        >
          <CloseOutMock />
        </StepCard>
        <StepCard
          num="3"
          title="See the pattern"
          body="After a handful of close-outs, the dashboard shows which job types actually pay — and which ones to stop bidding. Your next quote gets smarter automatically."
          note="No extra charge."
          noteTone="moss"
        >
          <ProfitChartMock />
        </StepCard>
      </div>
    </section>
  );
}

function StepCard({
  num,
  title,
  body,
  note,
  noteTone,
  children,
}: {
  num: string;
  title: string;
  body: React.ReactNode;
  note: string;
  noteTone: "moss" | "safety";
  children?: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 font-bold text-chalk">
        {num}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-fog">{body}</p>
      {children}
      <p
        className={`mt-3 text-xs uppercase tracking-wider ${
          noteTone === "safety" ? "text-safety" : "text-moss"
        }`}
      >
        {note}
      </p>
    </div>
  );
}

function CloseOutMock() {
  return (
    <div
      className="mt-4 rounded-lg border border-safety/30 bg-ink p-4 font-mono text-xs"
      aria-hidden
    >
      <div className="mb-2 text-[10px] uppercase tracking-wider text-fog">
        Close-out · Mrs. Alvarez
      </div>
      <div className="flex justify-between">
        <span className="text-fog">Quoted</span>
        <span>$1,520</span>
      </div>
      <div className="flex justify-between">
        <span className="text-fog">Actual</span>
        <span>$1,306</span>
      </div>
      <div className="flex justify-between">
        <span className="text-fog">Profit</span>
        <span className="text-moss">+$214 · 14%</span>
      </div>
      <div className="mt-2 border-t border-white/10 pt-2 text-[11px] italic text-fog">
        &ldquo;Driveway was 40 ft longer than I measured.&rdquo;
      </div>
    </div>
  );
}

function ProfitChartMock() {
  const rows: { name: string; pct: number; color: string }[] = [
    { name: "Service calls", pct: 22, color: "bg-moss" },
    { name: "Panel upgrades", pct: -8, color: "bg-rust" },
    { name: "Remodels", pct: 14, color: "bg-moss" },
  ];
  const max = Math.max(...rows.map((r) => Math.abs(r.pct)));
  return (
    <div className="mt-4 space-y-2" aria-hidden>
      {rows.map((r) => {
        const widthPct = (Math.abs(r.pct) / max) * 45; // up to 45% of half-width
        return (
          <div key={r.name} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate text-fog">{r.name}</span>
            <div className="relative h-2 flex-1 rounded bg-white/5">
              <div
                className="absolute top-0 h-full w-px bg-white/20"
                style={{ left: "50%" }}
              />
              <div
                className={`absolute top-0 h-2 rounded ${r.color}`}
                style={{
                  width: `${widthPct}%`,
                  left: r.pct < 0 ? `${50 - widthPct}%` : "50%",
                }}
              />
            </div>
            <span
              className={`w-10 shrink-0 text-right font-mono ${
                r.pct < 0 ? "text-rust" : "text-moss"
              }`}
            >
              {r.pct > 0 ? "+" : ""}
              {r.pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mt-20">
      <h2 className="text-3xl font-bold tracking-tight">Pricing</h2>
      <p className="mt-3 max-w-2xl text-fog">
        Credit packs, no subscription. You don&rsquo;t pay a gym membership to lift
        once a month. Buy a pack, close out jobs as you do them, top up when you run
        out.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <PackCard
          name="Starter"
          price="$29"
          credits="10 close-outs"
          perUnit="$2.90 per close-out"
        />
        <PackCard
          name="Pro"
          price="$79"
          credits="40 close-outs"
          perUnit="$1.98 per close-out"
          savings="Save $0.92 per close-out vs. Starter"
          highlight
        />
      </div>
      <ul className="mt-6 space-y-1 text-sm text-fog">
        <li>• First close-out is always free.</li>
        <li>• Packs never expire.</li>
        <li>• Full refund on unused packs within 30 days.</li>
      </ul>
    </section>
  );
}

function PackCard({
  name,
  price,
  credits,
  perUnit,
  savings,
  highlight = false,
}: {
  name: string;
  price: string;
  credits: string;
  perUnit: string;
  savings?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`card relative ${
        highlight ? "border-rust/60 ring-1 ring-rust/40" : ""
      }`}
    >
      {highlight && (
        <span className="absolute -top-2 right-4 rounded-full bg-rust px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          Best value
        </span>
      )}
      <h3 className="text-xl font-bold">{name}</h3>
      <div className="mt-2 font-mono text-4xl font-bold">{price}</div>
      <div className="mt-1 text-sm text-fog">{credits}</div>
      <div className="mt-1 text-xs text-fog">{perUnit}</div>
      {savings && <div className="mt-1 text-xs text-moss">{savings}</div>}
      <a href="/login?mode=signup" className="btn-primary mt-6 w-full">
        Get started
      </a>
    </div>
  );
}

function FAQ() {
  // Order matters: subscription-fatigue is the #1 objection — answer second.
  const faqs = [
    {
      q: "Is the calculator actually free?",
      a: "Yes. Quote as many jobs as you want, no account, no paywall. The paid part is the close-out feedback loop — and only if you find it useful.",
    },
    {
      q: "Is this a subscription I have to cancel?",
      a: "No. There is nothing to cancel. One-time pack purchase, credits never expire.",
    },
    {
      q: "What do I get with a close-out?",
      a: "Per job: quoted total, actual total, profit dollars, profit percent, variance percent, and your one-line “what surprised me” note. Across jobs: a dashboard that shows profit by job type.",
    },
    {
      q: "What happens when I run out of credits?",
      a: "Your data stays. You can still quote new jobs for free and view every past close-out. To close out a new one, buy another pack.",
    },
    {
      q: "Can I use this on my phone on a job site?",
      a: "Yes. The whole thing works on mobile. No app to install.",
    },
  ];
  return (
    <section id="faq" className="mt-20">
      <h2 className="text-3xl font-bold tracking-tight">FAQ</h2>
      <div className="mt-6 space-y-4">
        {faqs.map((f) => (
          <details key={f.q} className="card group">
            <summary className="cursor-pointer list-none font-semibold">
              <span className="mr-2 text-rust group-open:hidden">+</span>
              <span className="mr-2 hidden text-rust group-open:inline">−</span>
              {f.q}
            </summary>
            <p className="mt-3 text-sm text-fog">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mt-20 rounded-xl border border-rust/30 bg-steel p-8 text-center">
      <h2 className="text-2xl font-bold md:text-3xl">
        Next quote — closed out — before the weekend.
      </h2>
      <div className="mt-5">
        <a href="#calculator" className="btn-primary">
          Start a free quote →
        </a>
      </div>
      <p className="mt-3 text-sm text-fog">
        No credit card. First close-out free.
      </p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 pt-8 text-sm text-fog">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>© {new Date().getFullYear()} Quotr</span>
        <div className="flex gap-1">
          <a
            href="/login"
            className="rounded px-2 py-1 transition hover:bg-white/5 hover:text-chalk"
          >
            Sign in
          </a>
          <a
            href="#pricing"
            className="rounded px-2 py-1 transition hover:bg-white/5 hover:text-chalk"
          >
            Pricing
          </a>
          <a
            href="mailto:hello@quotr.app"
            className="rounded px-2 py-1 transition hover:bg-white/5 hover:text-chalk"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
