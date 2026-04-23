"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LAST_EMAIL_KEY = "quotr.last_email";

type Mode = "sign-in" | "sign-up";
type Status = "idle" | "submitting" | "error";

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill the last email used + auto-switch to sign-in for returning users.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setMode("sign-in");
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

        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="mb-3 text-center text-sm text-fog">
            {isSignUp ? "Already have an account?" : "New to Quotr?"}
          </p>
          <button
            type="button"
            onClick={() => switchMode(isSignUp ? "sign-in" : "sign-up")}
            className="btn-ghost w-full"
          >
            {isSignUp ? "Sign in instead" : "Create an account"}
          </button>
        </div>
      </div>
    </main>
  );
}

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
    return "Check your inbox — you need to confirm your email before signing in.";
  }
  return mode === "sign-up"
    ? `Couldn't create account: ${message}`
    : `Couldn't sign in: ${message}`;
}
