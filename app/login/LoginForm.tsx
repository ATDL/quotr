"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LAST_EMAIL_KEY = "quotr.last_email";

type Mode = "sign-in" | "sign-up";
type Status = "idle" | "submitting" | "error";

export default function LoginForm({
  initialMode = "sign-in",
}: {
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [forgotSent, setForgotSent] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

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
    setForgotSent(false);

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

    window.location.href = "/dashboard";
  }

  async function onGoogle() {
    setStatus("submitting");
    setErrorMessage("");
    setForgotSent(false);

    const supabase = createClient();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` },
    });

    if (error) {
      setStatus("error");
      setErrorMessage("Couldn't start Google sign-in. Try email instead.");
    }
    // On success Supabase redirects to Google — nothing more to do here.
  }

  async function onForgot() {
    if (!email) {
      setStatus("error");
      setErrorMessage("Enter your email first, then tap Forgot password.");
      emailInputRef.current?.focus();
      return;
    }
    setStatus("submitting");
    setErrorMessage("");

    const supabase = createClient();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback`,
    });

    if (error) {
      setStatus("error");
      setErrorMessage(friendlyError(error.message, "sign-in"));
      return;
    }

    setStatus("idle");
    setForgotSent(true);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setErrorMessage("");
    setForgotSent(false);
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
        <div className="mb-4 rounded-lg border border-safety/25 bg-safety/5 p-3 text-center text-xs text-fog">
          Sign up once · first close-out free · no subscription
        </div>

        {/* Segmented tab toggle */}
        <div className="mb-6 grid grid-cols-2 rounded-lg border border-white/10 p-1">
          <button
            type="button"
            onClick={() => switchMode("sign-in")}
            className={`rounded px-3 py-2 text-sm font-medium transition ${
              mode === "sign-in"
                ? "bg-steel text-chalk"
                : "text-fog hover:text-chalk"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("sign-up")}
            className={`rounded px-3 py-2 text-sm font-medium transition ${
              mode === "sign-up"
                ? "bg-steel text-chalk"
                : "text-fog hover:text-chalk"
            }`}
          >
            Create account
          </button>
        </div>

        <h1 className="text-xl font-bold tracking-tight">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-fog">
          {isSignUp
            ? "Email and a password. Takes 10 seconds."
            : "Sign in to your dashboard."}
        </p>

        <button
          type="button"
          onClick={onGoogle}
          disabled={status === "submitting"}
          className="btn-ghost mt-5 w-full gap-2"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-fog">
          <div className="h-px flex-1 bg-white/10" />
          <span>or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
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
              minLength={8}
              placeholder={
                isSignUp ? "At least 8 characters" : "Your password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status === "submitting"}
            />
            {!isSignUp && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={onForgot}
                  disabled={status === "submitting"}
                  className="text-xs text-fog underline underline-offset-2 hover:text-chalk"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {status === "error" && (
            <p className="text-sm text-rust">{errorMessage}</p>
          )}
          {forgotSent && (
            <p className="text-sm text-moss">
              Check your inbox for a reset link.
            </p>
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
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
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
    return "Password needs to be at least 8 characters.";
  }
  if (m.includes("email not confirmed")) {
    return "Check your inbox — you need to confirm your email before signing in.";
  }
  return mode === "sign-up"
    ? `Couldn't create account: ${message}`
    : `Couldn't sign in: ${message}`;
}
