import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function makeServerClientWithAuth(req: NextRequest) {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const cookieAdapter: {
    get: (name: string) => string | undefined;
    set: (
      name: string,
      value: string,
      options?: Record<string, unknown>
    ) => void;
    remove: (name: string, options?: Record<string, unknown>) => void;
  } = {
    get: (key: string) => req.cookies.get(key)?.value,
    set: () => {},
    remove: () => {},
  };
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: cookieAdapter,
      global: authHeader ? { headers: { Authorization: authHeader } } : {},
    }
  );
}

export async function requireUser(req: NextRequest) {
  const sb = makeServerClientWithAuth(req);
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) {
    return {
      user: null,
      sb,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user: data.user, sb, res: null };
}
