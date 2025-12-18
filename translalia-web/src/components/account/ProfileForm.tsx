"use client";

import * as React from "react";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabaseClient";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";

export function ProfileForm() {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const tAccount = useTranslations("Account");
  const tAuth = useTranslations("Auth");
  const currentLocale = useLocale();
  const { user, loading: userLoading } = useSupabaseUser();
  const { profile, loading, error, save, reload } = useProfile(user);
  const [displayName, setDisplayName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [locale, setLocale] = React.useState(currentLocale);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setUsername(profile?.username ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
    // Use profile locale if available, otherwise use current locale
    setLocale(profile?.locale ?? currentLocale);
  }, [profile, currentLocale]);

  if (userLoading || loading) {
    return <div className="text-sm text-neutral-500">{tCommon("loading")}</div>;
  }

  if (!user) {
    return <div className="text-sm">{tAuth("signInToManageProfile")}</div>;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setPending(true);
      setMsg(null);

      let nextAvatarUrl = avatarUrl;

      if (file && user) {
        const path = `${user.id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, file, { upsert: true });
        if (upErr) {
          setMsg(`${tCommon("error")}: ${upErr.message}`);
        } else {
          const { data } = supabase.storage.from("avatars").getPublicUrl(path);
          if (data?.publicUrl) {
            nextAvatarUrl = data.publicUrl;
            setAvatarUrl(nextAvatarUrl);
          }
        }
      }

      await save({
        display_name: displayName,
        username: username || null,
        avatar_url: nextAvatarUrl || null,
        locale: locale || null,
      });

      setMsg(tCommon("success"));

      // Navigate to the same pathname with new locale if it changed
      if (locale !== currentLocale) {
        router.replace(pathname, { locale: locale as any });
        // Force refresh to re-render server components with new locale
        router.refresh();
      }
    } catch (e) {
      const err = e as Error | { message?: string } | unknown;
      setMsg(
        (err as Error)?.message ??
          (err as { message?: string })?.message ??
          tCommon("error")
      );
    } finally {
      setPending(false);
      reload();
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div>
        <label className="block text-sm text-neutral-700">
          {tAccount("username")}
        </label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={tAccount("usernamePlaceholder")}
        />
        <p className="mt-1 text-xs text-neutral-500">
          {tAccount("usernameHint")}
        </p>
      </div>
      {error && (
        <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-md bg-neutral-100 p-2 text-sm text-neutral-700">
          {msg}
        </div>
      )}

      <div>
        <label className="block text-sm text-neutral-700">
          {tAccount("displayName")}
        </label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={tAccount("displayNamePlaceholder")}
        />
      </div>

      <div>
        <label className="block text-sm text-neutral-700">
          {t("language")}
        </label>
        <p className="text-xs text-neutral-500 mb-2">
          {t("languageDescription")}
        </p>
        <select
          className="mt-1 w-full rounded-md border px-3 py-2 bg-white"
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
        >
          <option value="en">English</option>
          <option value="es">Español (Spanish)</option>
          <option value="hi">हिन्दी (Hindi)</option>
          <option value="ar">العربية (Arabic)</option>
          <option value="zh">中文 (Mandarin)</option>
        </select>
      </div>

      <div className="grid gap-2">
        <label className="block text-sm text-neutral-700">
          {tAccount("avatar")}
        </label>
        {avatarUrl && (
          <div className="flex items-center gap-3 rounded-md border p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={tAccount("avatarPreview")}
              className="h-12 w-12 rounded-full border object-cover"
            />
            <div className="text-sm text-neutral-600">
              {tAccount("avatarPreviewHint")}
            </div>
          </div>
        )}
        <input
          className="w-full rounded-md border px-3 py-2"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder={tAccount("avatarUrlPlaceholder")}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block text-sm"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-2 text-white disabled:opacity-60"
        >
          {pending ? tCommon("loading") : t("saveProfile")}
        </button>
      </div>
    </form>
  );
}
