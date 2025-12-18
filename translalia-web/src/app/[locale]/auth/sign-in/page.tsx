"use client";

import * as React from "react";
import { useRouter } from "@/i18n/routing";
import { supabase } from "@/lib/supabaseClient";
import { resolveIdentifierToEmail } from "@/lib/authHelpers";
import { useTranslations } from "next-intl";

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
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">{t("signInTitle")}</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("usernameOrEmail")}
          </label>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t("usernamePlaceholder")}
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("password")}
          </label>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            autoComplete="current-password"
            required
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black text-white py-2 disabled:opacity-70"
          aria-busy={loading}
        >
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </form>
    </div>
  );
}
