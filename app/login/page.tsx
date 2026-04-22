"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Magic-link sign-in. No passwords, no social. One input, one button.
 *
 * Flow:
 *   1. User types email → submit
 *   2. Supabase emails a link containing a one-time code
 *   3. User clicks link → lands on /auth/callback?code=... which exchanges
 *      the code for a session and redirects to /dashboard
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <a
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-fog hover:text-chalk"
      >
        <span aria-hidden>←</span> Back to Quotr
      </a>

      <div className="card">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-fog">
          We&rsquo;ll email you a one-click link. No password.
        </p>

        {status === "sent" ? (
          <div className="mt-6 rounded-lg border border-moss/40 bg-moss/10 p-4 text-sm">
            <p className="font-semibold text-moss">Check your inbox.</p>
            <p className="mt-1 text-fog">
              We sent a sign-in link to <span className="text-chalk">{email}</span>.
              It&rsquo;s good for 1 hour.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setEmail("");
              }}
              className="mt-3 text-xs text-fog underline hover:text-chalk"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "sending"}
              />
            </div>

            {status === "error" && (
              <p className="text-sm text-rust">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={status === "sending" || !email}
              className="btn-primary w-full"
            >
              {status === "sending" ? "Sending link…" : "Email me a sign-in link"}
            </button>

            <p className="text-[11px] text-fog">
              New here? Your account gets created automatically and you&rsquo;ll
              have 1 free close-out waiting.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
