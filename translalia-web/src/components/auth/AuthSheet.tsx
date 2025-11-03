"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { generatePassword } from "@/lib/password";

type Tab = "signin" | "quick";

export function AuthSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const redirectTo =
    typeof window !== "undefined" ? window.location.origin : "";
  const [pending, setPending] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>("signin");

  // Sign in state
  const [identifier, setIdentifier] = React.useState(""); // email or username
  const [password, setPassword] = React.useState("");

  // Quick account state
  const [qaEmail, setQaEmail] = React.useState("");
  const [qaUsername, setQaUsername] = React.useState("");
  const [qaGenerated, setQaGenerated] = React.useState<string | null>(null);

  function close() {
    setIdentifier("");
    setPassword("");
    setQaEmail("");
    setQaUsername("");
    setQaGenerated(null);
    setMsg(null);
    onOpenChange(false);
  }

  async function oauth(provider: "google" | "github") {
    try {
      setPending(true);
      setMsg(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (e) {
      const err = e as Error | { message?: string };
      setMsg(`Error: ${("message" in err && err.message) || String(e)}`);
    } finally {
      setPending(false);
    }
  }

  // Resolve email if identifier is a username
  async function resolveEmailFromIdentifier(id: string): Promise<string> {
    if (id.includes("@")) return id;
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("username", id)
      .single();
    if (error || !data?.email) {
      throw new Error("Username not found");
    }
    return data.email as string;
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier || !password || pending) return;
    try {
      setPending(true);
      setMsg(null);
      const email = await resolveEmailFromIdentifier(identifier.trim());
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      close();
    } catch (e) {
      const err = e as Error | { message?: string };
      setMsg(
        `Sign-in error: ${("message" in err && err.message) || String(e)}`
      );
    } finally {
      setPending(false);
    }
  }

  async function onQuickAccount(e: React.FormEvent) {
    e.preventDefault();
    const email = qaEmail.trim();
    const username = qaUsername.trim();
    if (!email || !username || pending) return;
    try {
      setPending(true);
      setMsg(null);

      // Optional: pre-check username availability for friendlier errors
      const { data: exists } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (exists) throw new Error("Username already taken");

      // Generate a strong password and sign up
      const generated = generatePassword(20);
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password: generated,
        options: { emailRedirectTo: redirectTo },
      });
      if (signUpErr) throw signUpErr;

      // Ensure session (some projects auto-create; some don’t)
      await supabase.auth.signInWithPassword({ email, password: generated });

      // Upsert username & email into profiles
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        const { error: upErr } = await supabase
          .from("profiles")
          .upsert({ id: user.id, username, email }, { onConflict: "id" });
        if (upErr) throw upErr;
      }

      setQaGenerated(generated); // Show once to user
      setTab("signin");
      setIdentifier(email);
      setMsg("Account created. Copy your password below to save it.");
    } catch (e) {
      const err = e as Error | { message?: string };
      setMsg(
        `Sign-up error: ${("message" in err && err.message) || String(e)}`
      );
    } finally {
      setPending(false);
    }
  }

  function copy(text?: string | null) {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setMsg("Password copied to clipboard.");
  }

  if (!open) return null;
  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 sm:p-6"
      onClick={close}
      onKeyDown={(e) => e.key === "Escape" && close()}
      tabIndex={-1}
    >
      <div
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div id="auth-title" className="font-semibold">
            Sign in
          </div>
          <button
            onClick={close}
            className="text-sm text-neutral-600"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Tabs */}
          <div className="flex gap-2 text-xs">
            <button
              className={
                "rounded border px-2 py-1 " +
                (tab === "signin" ? "bg-neutral-900 text-white" : "")
              }
              onClick={() => setTab("signin")}
            >
              Sign in
            </button>
            <button
              className={
                "rounded border px-2 py-1 " +
                (tab === "quick" ? "bg-neutral-900 text-white" : "")
              }
              onClick={() => setTab("quick")}
            >
              Quick account
            </button>
            <span className="ml-auto text-neutral-500">
              (OAuth also available)
            </span>
          </div>

          {/* OAuth row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => oauth("google")}
              disabled={pending}
              className="rounded-md border px-3 py-2 text-sm"
            >
              Continue with Google
            </button>
            <button
              onClick={() => oauth("github")}
              disabled={pending}
              className="rounded-md border px-3 py-2 text-sm"
            >
              Continue with GitHub
            </button>
          </div>

          {/* Sign in (email OR username) */}
          {tab === "signin" && (
            <form onSubmit={onSignIn} className="space-y-2">
              <label className="block text-sm text-neutral-700">
                Email or username
              </label>
              <input
                className="w-full rounded-md border px-3 py-2"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or poet_ari"
                required
              />
              <label className="block text-sm text-neutral-700">Password</label>
              <input
                type="password"
                className="w-full rounded-md border px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
              />
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-md bg-neutral-900 px-3 py-2 text-white disabled:opacity-60"
              >
                {pending ? "Signing in…" : "Sign in"}
              </button>
              {qaGenerated && (
                <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                  Tip: you just created an account. Use your email and the
                  generated password below.
                </div>
              )}
            </form>
          )}

          {/* Quick account (email + username → generated password) */}
          {tab === "quick" && (
            <form onSubmit={onQuickAccount} className="space-y-2">
              <label className="block text-sm text-neutral-700">Email</label>
              <input
                type="email"
                className="w-full rounded-md border px-3 py-2"
                value={qaEmail}
                onChange={(e) => setQaEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <label className="block text-sm text-neutral-700">Username</label>
              <input
                className="w-full rounded-md border px-3 py-2"
                value={qaUsername}
                onChange={(e) => setQaUsername(e.target.value)}
                placeholder="poet_ari"
                required
              />
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-md bg-neutral-900 px-3 py-2 text-white disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create account (auto-password)"}
              </button>

              {/* Show password IF generated this session */}
              {qaGenerated && (
                <div className="rounded-md bg-neutral-100 p-2 text-sm">
                  <div className="mb-1">Generated password (save it now):</div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="rounded bg-white px-2 py-1">
                      {qaGenerated}
                    </code>
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() => copy(qaGenerated)}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {msg && (
            <div className="rounded-md bg-neutral-100 p-2 text-sm text-neutral-700">
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render in a portal to avoid being constrained by header stacking/overflow
  if (typeof document !== "undefined") {
    return createPortal(overlay, document.body);
  }
  return overlay;
}
