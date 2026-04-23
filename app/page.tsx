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
      <nav className="flex items-center gap-5 text-sm text-fog">
        <a href="#pricing" className="hover:text-chalk">
          Pricing
        </a>
        <a href="#faq" className="hover:text-chalk">
          FAQ
        </a>
        <a href="/login" className="hover:text-chalk">
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
  const steps = [
    {
      num: "1",
      title: "Quote it",
      body:
        "Type in hours, materials, hourly rate. Quotr spits out a number you can give the customer in under 60 seconds.",
      note: "Free. No account.",
    },
    {
      num: "2",
      title: "Close it out",
      body:
        "Job's done? Punch in actual hours and actual material cost. Add a one-line \u201Cwhat surprised me.\u201D Quotr compares quote to reality and shows profit.",
      note: "One credit per close-out. First one on us.",
    },
    {
      num: "3",
      title: "See the pattern",
      body:
        "After a handful of close-outs, the dashboard shows which job types actually pay — and which ones to stop bidding. Your next quote gets smarter automatically.",
      note: "No extra charge.",
    },
  ];

  return (
    <section className="mt-20">
      <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.num} className="card">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-rust font-bold">
              {s.num}
            </div>
            <h3 className="text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-fog">{s.body}</p>
            <p className="mt-3 text-xs uppercase tracking-wider text-moss">
              {s.note}
            </p>
          </div>
        ))}
      </div>
    </section>
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
  highlight = false,
}: {
  name: string;
  price: string;
  credits: string;
  perUnit: string;
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
      <a href="/login" className="btn-primary mt-6 w-full">
        Get started
      </a>
    </div>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "Is the calculator actually free?",
      a: "Yes. Quote as many jobs as you want, no account, no paywall. The paid part is the close-out feedback loop — and only if you find it useful.",
    },
    {
      q: "What do I get with a close-out?",
      a: "Per job: quoted total, actual total, profit dollars, profit percent, variance percent, and your one-line \u201Cwhat surprised me\u201D note. Across jobs: a dashboard that shows profit by job type.",
    },
    {
      q: "What happens when I run out of credits?",
      a: "Your data stays. You can still quote new jobs for free and view every past close-out. To close out a new one, buy another pack.",
    },
    {
      q: "Is this a subscription I have to cancel?",
      a: "No. There is nothing to cancel. One-time pack purchase, credits never expire.",
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
        <div className="flex gap-5">
          <a href="/login" className="hover:text-chalk">
            Sign in
          </a>
          <a href="#pricing" className="hover:text-chalk">
            Pricing
          </a>
          <a href="mailto:hello@quotr.app" className="hover:text-chalk">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
