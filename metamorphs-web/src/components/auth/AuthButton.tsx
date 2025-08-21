"use client";

import * as React from "react";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { supabase } from "@/lib/supabaseClient";
import { AuthSheet } from "./AuthSheet";
import Link from "next/link";
import { useProfile } from "@/hooks/useProfile";

export function AuthButton() {
  const { user, loading } = useSupabaseUser();
  const { profile } = useProfile(user);
  const [open, setOpen] = React.useState(false);
  const initials =
    profile?.display_name?.trim()?.slice(0, 1).toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "?";

  if (loading) {
    return (
      <button className="rounded-md border bg-white px-2 py-1 text-xs shadow">
        …
      </button>
    );
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="rounded-md border bg-white px-2 py-1 text-xs shadow dark:bg-neutral-800 dark:text-neutral-100"
        >
          Sign in
        </button>
        <AuthSheet open={open} onOpenChange={setOpen} />
      </>
    );
  }

  // Minimal user menu: avatar -> Account + Sign out
  return (
    <div className="inline-flex items-center gap-2">
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
        className="rounded-md border bg-white px-2 py-1 text-xs shadow dark:bg-neutral-800 dark:text-neutral-100"
      >
        Account
      </Link>
      <button
        onClick={() => supabase.auth.signOut()}
        className="rounded-md border bg-white px-2 py-1 text-xs shadow dark:bg-neutral-800 dark:text-neutral-100"
      >
        Sign out
      </button>
    </div>
  );
}
