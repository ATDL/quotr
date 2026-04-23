"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LAST_EMAIL_KEY = "quotr.last_email";

type Mode = "sign-in" | "sign-up";
type Status = "idle" | "submitting" | "error";

/**
 * Email + password sign-in. Two explicit modes — sign-in for returning users,
 * sign-up for new ones — toggled by a link at the bottom.
 *
 * Magic links are deferred until post-MVP polish so Alberto can test the
 * whole flow end-to-end without waiting on email delivery.
 *
 * Requires: Supabase Auth → Providers → Email → "Confirm email" OFF, so sign-up
 * returns a live session immediately instead of a "please confirm" placeholder.
 */
export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("sign-up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill the last email used + focus the right input on mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setTimeout(() => passwordInputRef.current?.focus(), 0);
        return;
      }
    } catch {
      /* private mode / disabled storage — fine */
    }
    emailInputRef.current?.focus();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setStatus("submitting");
    setErrorMessage("");

    const supabase = createClient();

    const { error } =
      mode === "sign-up"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus("error");
      setErrorMessage(friendlyError(error.message, mode));
      return;
    }

    // Persist only on successful auth.
    try {
      window.localStorage.setItem(LAST_EMAIL_KEY, email);
    } catch {
      /* ignore */
    }

    // Hard navigation so the server renders /dashboard with fresh cookies.
    window.location.href = "/dashboard";
  }

  function switchMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setErrorMessage("");
    setPassword("");
    setTimeout(() => {
      if (email) passwordInputRef.current?.focus();
      else emailInputRef.current?.focus();
    }, 0);
  }

  const isSignUp = mode === "sign-up";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <a
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-fog hover:text-chalk"
      >
        <span aria-hidden>←</span> Back to Quotr
      </a>

      <div className="card">
        <h1 className="text-2xl font-bold tracking-tight">
          {isSignUp ? "Create your account" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm text-fog">
          {isSignUp
            ? "Email and a password. Takes 10 seconds. 1 free close-out on us."
            : "Welcome back."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              ref={emailInputRef}
              className="input"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "submitting"}
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              ref={passwordInputRef}
              className="input"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              minLength={6}
              placeholder={isSignUp ? "At least 6 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status === "submitting"}
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-rust">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={status === "submitting" || !email || !password}
            className="btn-primary w-full"
          >
            {status === "submitting"
              ? isSignUp
                ? "Creating account…"
                : "Signing in…"
              : isSignUp
              ? "Create account"
              : "Sign in"}
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-4 text-center text-sm text-fog">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("sign-in")}
                className="text-chalk underline hover:text-rust"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New here?{" "}
              <button
                type="button"
                onClick={() => switchMode("sign-up")}
                className="text-chalk underline hover:text-rust"
              >
                Create an account
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * Translate Supabase's sometimes-cryptic error strings into something a
 * tradesperson would actually understand.
 */
function friendlyError(message: string, mode: Mode): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email or password doesn't match. Double-check, or create an account instead.";
  }
  if (m.includes("user already registered")) {
    return "An account with that email already exists. Try signing in.";
  }
  if (m.includes("password should be at least")) {
    return "Password needs to be at least 6 characters.";
  }
  if (m.includes("email not confirmed")) {
    return "This email was created with confirmation on. Disable 'Confirm email' in Supabase Auth settings and try again.";
  }
  return mode === "sign-up"
    ? `Couldn't create account: ${message}`
    : `Couldn't sign in: ${message}`;
}
