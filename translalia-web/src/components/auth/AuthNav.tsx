"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useProfile } from "@/hooks/useProfile";

export function AuthNav() {
  const router = useRouter();
  const { user, loading } = useSupabaseUser();
  const { profile } = useProfile(user);

  if (loading) {
    return <div className="text-xs text-neutral-500">…</div>;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/auth/sign-in"
          className="rounded-md border bg-white px-2 py-1 text-xs shadow"
        >
          Sign in
        </Link>
        <Link
          href="/auth/sign-up"
          className="rounded-md bg-neutral-900 px-2 py-1 text-xs text-white shadow"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const initials =
    profile?.display_name?.trim()?.slice(0, 1).toUpperCase() ??
    user.email?.[0]?.toUpperCase() ??
    "?";

  return (
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
        Account
      </Link>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.refresh();
        }}
        className="rounded-md border bg-white px-2 py-1 text-xs shadow"
      >
        Sign out
      </button>
    </div>
  );
}
