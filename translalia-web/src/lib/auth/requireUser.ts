import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Ensures a user session exists; returns 401 JSON response otherwise.
 *
 * Auth strategy (matches apiGuard.ts):
 *  1) Cookie-bound session via supabaseServer() (App Router default)
 *  2) Fallback: Authorization: Bearer <access_token> header
 *
 * Returns the authenticated Supabase client (`sb`) so routes can use it
 * for DB reads that respect the caller's session/RLS context, regardless
 * of whether auth came from cookies or a bearer token.
 */
export async function requireUser() {
  // 1) Try cookie-bound session
  const cookieClient = await supabaseServer();
  const { data } = await cookieClient.auth.getUser();
  if (data?.user) {
    return {
      user: data.user,
      response: null as any,
      sb: cookieClient as unknown as SupabaseClient,
    };
  }

  // 2) Fallback: Bearer token from Authorization header
  try {
    const headerStore = await headers();
    const authHeader = headerStore.get("authorization") || "";
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const sbBearer = createSupabaseClient(url, anon, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: bearerData } = await sbBearer.auth.getUser();
      if (bearerData?.user) {
        return {
          user: bearerData.user,
          response: null as any,
          sb: sbBearer as unknown as SupabaseClient,
        };
      }
    }
  } catch {
    // Bearer fallback failed; fall through to 401
  }

  // 3) No session found
  return {
    user: null as any,
    response: NextResponse.json(
      { error: "Unauthenticated" },
      { status: 401 }
    ),
    sb: null as any,
  };
}
