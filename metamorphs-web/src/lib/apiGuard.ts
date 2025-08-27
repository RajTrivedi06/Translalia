import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireUser(req: NextRequest) {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const cookieMethods = {
    get: (name: string) => cookieStore.get(name)?.value,
    set: () => {},
    remove: () => {},
  };

  // Primary: cookie-based client (SSR)
  let sb: SupabaseClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: cookieMethods,
    }
  ) as unknown as SupabaseClient;
  let { data: { user } = { user: null } } = await sb.auth.getUser();

  // Fallback: bearer token
  if (!user) {
    const authz =
      req.headers.get("authorization") ||
      hdrs.get("authorization") ||
      hdrs.get("Authorization");
    if (authz?.startsWith("Bearer ")) {
      const token = authz.slice(7);
      sb = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: cookieMethods,
          global: { headers: { Authorization: `Bearer ${token}` } },
        }
      ) as unknown as SupabaseClient;
      ({ data: { user } = { user: null } } = await sb.auth.getUser());
    }
  }

  if (!user) {
    return {
      user: null,
      sb,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  return { user, sb, res: null } as const;
}
