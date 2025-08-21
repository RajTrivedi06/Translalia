"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMsg("Passwords do not match");
      return;
    }
    try {
      setPending(true);
      setMsg(null);
      // Sign up (with email confirmation OFF in Supabase, this creates an immediate usable account)
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      // Some setups require explicit sign-in after sign-up:
      await supabase.auth.signInWithPassword({ email, password });

      // Redirect user to fill out profile
      router.push("/account");
      router.refresh();
    } catch (e) {
      const err = e as Error | { message?: string };
      const raw = (("message" in err && err.message) ||
        "Sign up failed") as string;
      if (raw.toLowerCase().includes("email signups are disabled")) {
        setMsg(
          "Email signups are disabled in Supabase. Enable the Email provider and turn off 'Confirm email'."
        );
      } else {
        setMsg(raw);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-2 text-2xl font-semibold">Create your account</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="underline">
          Sign in
        </Link>
      </p>

      {msg && (
        <div className="mb-3 rounded-md bg-red-50 p-2 text-sm text-red-700">
          {msg}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-neutral-700">Email</label>
          <input
            type="email"
            required
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-700">Password</label>
          <input
            type="password"
            required
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-700">
            Confirm password
          </label>
          <input
            type="password"
            required
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="Repeat password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-white disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
