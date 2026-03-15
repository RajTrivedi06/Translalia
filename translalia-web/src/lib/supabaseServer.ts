import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env, assertEnv } from "./env";

export async function getServerClient() {
  // Lazy validation - only check when function is called, not at module load
  assertEnv();

  try {
    const cookieStore = await cookies();

    return createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      }
    );
  } catch {
    // Outside Next.js request context (e.g., worker scripts).
    // Fall back to a direct client using the service role key (bypasses RLS).
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Cannot create Supabase client outside request context: SUPABASE_SERVICE_ROLE_KEY is not set"
      );
    }
    return createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
}

// Backwards-compatible alias until all imports are migrated
export async function supabaseServer() {
  return getServerClient();
}
