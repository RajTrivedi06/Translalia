"use client";

import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useProfile } from "@/hooks/useProfile";
import { Home, FolderKanban, BookOpen } from "lucide-react";
import { useState, useRef, useEffect } from "react";

function NavLinkWithTooltip({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverRef = useRef(false);

  const handleMouseEnter = () => {
    hoverRef.current = true;
    timeoutRef.current = setTimeout(() => {
      if (hoverRef.current) {
        setShowTooltip(true);
      }
    }, 1000); // 1 second delay
  };

  const handleMouseLeave = () => {
    hoverRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <Link
        href={href}
        className="flex items-center justify-center rounded-full p-2 transition hover:bg-slate-100"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={label}
      >
        <Icon className="h-5 w-5 text-slate-600" />
      </Link>
      {showTooltip && (
        <div className="absolute right-full top-1/2 z-50 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
          {label}
          <div className="absolute left-full top-1/2 -translate-y-1/2 -ml-1 h-2 w-2 rotate-45 bg-slate-900" />
        </div>
      )}
    </div>
  );
}

function PrimaryNav() {
  const t = useTranslations("Navigation");

  const navLinks = [
    { href: "/", label: t("home"), icon: Home },
    { href: "/workspaces", label: t("workspaces"), icon: FolderKanban },
    { href: "/diary", label: t("diary"), icon: BookOpen },
    // { href: "/verification-dashboard", label: "Verification Analytics" },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {navLinks.map((link) => (
        <NavLinkWithTooltip
          key={link.href}
          href={link.href}
          label={link.label}
          icon={link.icon}
        />
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
