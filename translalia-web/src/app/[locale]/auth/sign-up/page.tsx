"use client";

import * as React from "react";
import { Link, useRouter } from "@/i18n/routing";
import { supabase } from "@/lib/supabaseClient";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMsg(t("passwordsDoNotMatch"));
      return;
    }
    try {
      setPending(true);
      setMsg(null);
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      await supabase.auth.signInWithPassword({ email, password });

      router.push("/account");
      router.refresh();
    } catch (e) {
      const err = e as Error | { message?: string };
      const raw = (("message" in err && err.message) ||
        t("signUpFailed")) as string;
      if (raw.toLowerCase().includes("email signups are disabled")) {
        setMsg(t("emailSignupsDisabled"));
      } else {
        setMsg(raw);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-56px)] items-center justify-center overflow-hidden bg-gradient-to-b from-stone-50 to-stone-100 px-4 py-12">
      {/* Decorative background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-1/3 h-[400px] w-[400px] rounded-full bg-sky-100 opacity-40 blur-[120px]" />
        <div className="absolute -right-32 bottom-1/3 h-[300px] w-[300px] rounded-full bg-blue-100 opacity-40 blur-[100px]" />
        <div className="absolute right-1/4 top-[8%] h-28 w-28 rounded-full bg-sky-200/30 blur-[70px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Branding header */}
        <div className="mb-10 text-center">
          <div className="mb-6 flex items-center justify-center gap-3 text-[10px] tracking-[0.4em] text-slate-400">
            <div className="h-px w-8 bg-slate-300" />
            <span>GET STARTED</span>
            <div className="h-px w-8 bg-slate-300" />
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight text-slate-900">
            Trans<span className="italic text-sky-600">lalia</span>
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            {t("signUpTitle")}
          </p>
        </div>

        {/* Card with glassmorphism */}
        <div className="rounded-2xl bg-white/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/60 backdrop-blur-sm">
          {msg && (
            <div className="mb-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200/60">
              {msg}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("email")}
              </label>
              <Input
                type="email"
                required
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("password")}
              </label>
              <Input
                type="password"
                required
                placeholder={t("choosePasswordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("confirmPassword")}
              </label>
              <Input
                type="password"
                required
                placeholder={t("repeatPasswordPlaceholder")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl"
              size="lg"
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending ? t("creating") : t("createAccount")}
            </Button>
          </form>

          {/* Separator */}
          <div className="my-6 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

          <p className="text-center text-sm text-slate-500">
            {t("alreadyHaveAccount")}{" "}
            <Link
              href="/auth/sign-in"
              className="font-medium text-sky-600 transition-colors hover:text-sky-700"
            >
              {t("signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
