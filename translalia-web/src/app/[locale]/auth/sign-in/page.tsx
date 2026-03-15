"use client";

import * as React from "react";
import { Link, useRouter } from "@/i18n/routing";
import { supabase } from "@/lib/supabaseClient";
import { resolveIdentifierToEmail } from "@/lib/authHelpers";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const email = await resolveIdentifierToEmail(identifier);
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr) throw signErr;
      router.push("/workspaces");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("signInFailed");
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-56px)] items-center justify-center overflow-hidden bg-gradient-to-b from-stone-50 to-stone-100 px-4 py-12">
      {/* Decorative background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-sky-100 opacity-40 blur-[120px]" />
        <div className="absolute -left-32 bottom-1/4 h-[300px] w-[300px] rounded-full bg-blue-100 opacity-40 blur-[100px]" />
        <div className="absolute left-1/2 top-[10%] h-32 w-32 -translate-x-1/2 rounded-full bg-sky-200/30 blur-[80px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Branding header */}
        <div className="mb-10 text-center">
          <div className="mb-6 flex items-center justify-center gap-3 text-[10px] tracking-[0.4em] text-slate-400">
            <div className="h-px w-8 bg-slate-300" />
            <span>WELCOME BACK</span>
            <div className="h-px w-8 bg-slate-300" />
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight text-slate-900">
            Trans<span className="italic text-sky-600">lalia</span>
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            {t("signInTitle")}
          </p>
        </div>

        {/* Card with glassmorphism */}
        <div className="rounded-2xl bg-white/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/60 backdrop-blur-sm">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("usernameOrEmail")}
              </label>
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t("usernamePlaceholder")}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("password")}
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200/60">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl"
              size="lg"
              aria-busy={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? t("signingIn") : t("signIn")}
            </Button>
          </form>

          {/* Separator */}
          <div className="my-6 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

          <p className="text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/sign-up"
              className="font-medium text-sky-600 transition-colors hover:text-sky-700"
            >
              {t("signUp")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
