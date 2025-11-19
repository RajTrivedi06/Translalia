// src/lib/supabaseBrowser.ts
"use client";

import { createClient } from "@supabase/supabase-js";
import { env, assertEnv } from "./env";

export function createBrowserClient() {
  // Lazy validation - only check when function is called, not at module load
  assertEnv();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}
