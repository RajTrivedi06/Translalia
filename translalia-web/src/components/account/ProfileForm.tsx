"use client";

import * as React from "react";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabaseClient";

export function ProfileForm() {
  const { user, loading: userLoading } = useSupabaseUser();
  const { profile, loading, error, save, reload } = useProfile(user);
  const [displayName, setDisplayName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [locale, setLocale] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);

  React.useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setUsername(profile?.username ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
    setLocale(profile?.locale ?? "");
  }, [profile]);

  if (userLoading || loading) {
    return <div className="text-sm text-neutral-500">Loading…</div>;
  }

  if (!user) {
    return <div className="text-sm">Sign in to manage your profile.</div>;
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
          setMsg(`Upload error: ${upErr.message}`);
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
      setMsg("Saved.");
    } catch (e) {
      const err = e as Error | { message?: string } | unknown;
      setMsg(
        (err as Error)?.message ??
          (err as { message?: string })?.message ??
          "Save failed"
      );
    } finally {
      setPending(false);
      reload();
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div>
        <label className="block text-sm text-neutral-700">Username</label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g., poet_ari"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Letters, numbers, underscores, dots (3–30 chars). Must be unique.
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
        <label className="block text-sm text-neutral-700">Display name</label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
        />
      </div>

      <div>
        <label className="block text-sm text-neutral-700">Locale</label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2"
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          placeholder="e.g., en-US"
        />
      </div>

      <div className="grid gap-2">
        <label className="block text-sm text-neutral-700">Avatar</label>
        {avatarUrl && (
          <div className="flex items-center gap-3 rounded-md border p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt="Avatar preview"
              className="h-12 w-12 rounded-full border object-cover"
            />
            <div className="text-sm text-neutral-600">
              Preview of the image that will appear in the header.
            </div>
          </div>
        )}
        <input
          className="w-full rounded-md border px-3 py-2"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://… (or upload below)"
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
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
