"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  locale: string | null;
  created_at: string | null;
};

export function useProfile(user: User | null) {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, username, email, avatar_url, locale, created_at"
      )
      .eq("id", user.id)
      .single();
    if (error) setError(error.message);
    setProfile((data as Profile) ?? null);
    setLoading(false);
  }, [user]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function save(input: Partial<Profile>) {
    if (!user) return;
    const payload = { id: user.id, ...input };
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    setProfile(data as Profile);
  }

  return { profile, loading, error, reload: load, save };
}
