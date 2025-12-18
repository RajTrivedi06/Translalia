"use client";

import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useProfile } from "@/hooks/useProfile";

function PrimaryNav() {
  const t = useTranslations("Navigation");

  const navLinks = [
    { href: "/", label: t("home") },
    { href: "/workspaces", label: t("workspaces") },
    // { href: "/verification-dashboard", label: "Verification Analytics" },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 sm:text-sm">
      {navLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full px-3 py-1 transition hover:bg-slate-100"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function AuthNav() {
  const router = useRouter();
  const t = useTranslations("Navigation");
  const tCommon = useTranslations("Common");
  const tAuth = useTranslations("Auth");
  const { user, loading } = useSupabaseUser();
  const { profile } = useProfile(user);

  if (loading) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <PrimaryNav />
        <div className="text-xs text-neutral-500">{tCommon("loading")}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <PrimaryNav />
        <div className="flex items-center gap-2">
          <Link
            href="/auth/sign-in"
            className="rounded-md border bg-white px-2 py-1 text-xs shadow"
          >
            {tAuth("signIn")}
          </Link>
          <Link
            href="/auth/sign-up"
            className="rounded-md bg-neutral-900 px-2 py-1 text-xs text-white shadow"
          >
            {tAuth("signUp")}
          </Link>
        </div>
      </div>
    );
  }

  const initials =
    profile?.display_name?.trim()?.slice(0, 1).toUpperCase() ??
    user.email?.[0]?.toUpperCase() ??
    "?";

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <PrimaryNav />
      <div className="flex items-center gap-2">
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            className="h-6 w-6 rounded-full border object-cover"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-white text-[10px]">
            {initials}
          </div>
        )}
        <Link
          href="/account"
          className="rounded-md border bg-white px-2 py-1 text-xs shadow"
        >
          {t("account")}
        </Link>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.refresh();
          }}
          className="rounded-md border bg-white px-2 py-1 text-xs shadow"
        >
          {t("signOut")}
        </button>
      </div>
    </div>
  );
}
