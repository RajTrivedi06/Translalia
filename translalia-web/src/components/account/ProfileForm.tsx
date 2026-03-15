"use client";

import * as React from "react";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabaseClient";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

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
  const [msgType, setMsgType] = React.useState<"success" | "error">("success");
  const [pending, setPending] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setUsername(profile?.username ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
    setLocale(profile?.locale ?? currentLocale);
  }, [profile, currentLocale]);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 animate-pulse rounded-full bg-gradient-to-br from-sky-200 to-blue-200" />
            <Loader2 className="absolute inset-0 m-auto h-5 w-5 animate-spin text-sky-600" />
          </div>
          <p className="text-sm text-slate-500">{tCommon("loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        {tAuth("signInToManageProfile")}
      </div>
    );
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
          setMsgType("error");
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
      setMsgType("success");

      if (locale !== currentLocale) {
        router.replace(pathname, { locale: locale as any });
        router.refresh();
      }
    } catch (e) {
      const err = e as Error | { message?: string } | unknown;
      setMsg(
        (err as Error)?.message ??
          (err as { message?: string })?.message ??
          tCommon("error")
      );
      setMsgType("error");
    } finally {
      setPending(false);
      reload();
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-8">
      {/* Status messages */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200/60">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {msg && (
        <div
          className={`flex items-start gap-3 rounded-xl p-4 text-sm ring-1 ${
            msgType === "success"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200/60"
              : "bg-rose-50 text-rose-700 ring-rose-200/60"
          }`}
        >
          {msgType === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          <span>{msg}</span>
        </div>
      )}

      {/* Identity section */}
      <section>
        <div className="mb-5 flex items-center gap-3 text-[10px] tracking-[0.3em] text-slate-400">
          <span>01</span>
          <div className="h-px w-6 bg-slate-300" />
          <span>IDENTITY</span>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {tAccount("username")}
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={tAccount("usernamePlaceholder")}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              {tAccount("usernameHint")}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {tAccount("displayName")}
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={tAccount("displayNamePlaceholder")}
            />
          </div>
        </div>
      </section>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Preferences section */}
      <section>
        <div className="mb-5 flex items-center gap-3 text-[10px] tracking-[0.3em] text-slate-400">
          <span>02</span>
          <div className="h-px w-6 bg-slate-300" />
          <span>PREFERENCES</span>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            {t("language")}
          </label>
          <p className="mb-3 text-xs text-slate-400">
            {t("languageDescription")}
          </p>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español (Spanish)</SelectItem>
              <SelectItem value="es-AR">Español (Argentina)</SelectItem>
              <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
              <SelectItem value="ar">العربية (Arabic)</SelectItem>
              <SelectItem value="zh">中文 (Mandarin)</SelectItem>
              <SelectItem value="ta">தமிழ் (Tamil)</SelectItem>
              <SelectItem value="te">తెలుగు (Telugu)</SelectItem>
              <SelectItem value="ml">മലയാളം (Malayalam)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Avatar section */}
      <section>
        <div className="mb-5 flex items-center gap-3 text-[10px] tracking-[0.3em] text-slate-400">
          <span>03</span>
          <div className="h-px w-6 bg-slate-300" />
          <span>AVATAR</span>
        </div>

        <div className="space-y-4">
          {avatarUrl && (
            <div className="flex items-center gap-5 rounded-2xl border border-slate-200/60 bg-stone-50/60 p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt={tAccount("avatarPreview")}
                className="h-16 w-16 rounded-full border-2 border-white object-cover shadow-sm"
              />
              <p className="text-sm text-slate-500">
                {tAccount("avatarPreviewHint")}
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {tAccount("avatar")}
            </label>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder={tAccount("avatarUrlPlaceholder")}
            />
          </div>

          <label className="group flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-3.5 text-sm text-slate-600 transition-all hover:border-sky-300 hover:bg-sky-50/40">
            <Upload className="h-4 w-4 text-slate-400 transition-colors group-hover:text-sky-500" />
            <span>{file ? file.name : "Upload image file"}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
        </div>
      </section>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Save */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={pending}
          className="rounded-xl px-8"
          size="lg"
        >
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {pending ? tCommon("loading") : t("saveProfile")}
        </Button>
      </div>
    </form>
  );
}
