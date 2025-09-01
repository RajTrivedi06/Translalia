import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";

type GuardOk = { user: { id: string }; sb: SupabaseClient };
type GuardFail = { res: NextResponse };

export async function requireUser(
  req: NextRequest
): Promise<GuardOk | GuardFail> {
  // 1) Try cookie-bound session via App Router helper
  console.log("[requireUser] starting");
  try {
    const cookieStore = await cookies();
    const names = cookieStore.getAll().map((c) => c.name);
    console.log("[requireUser] cookie names", names);
    const sbCookie = (await supabaseServer()) as unknown as SupabaseClient;
    const { data: u1, error: e1 } = await sbCookie.auth.getUser();
    console.log("[requireUser] cookie flow", {
      hasUser: !!u1?.user,
      err: e1?.message,
    });
    if (u1?.user) return { user: { id: u1.user.id }, sb: sbCookie };
  } catch (e) {
    console.log("[requireUser] cookie flow threw", {
      err: (e as Error)?.message,
    });
    // ignore; fall through to Bearer
  }

  // 2) Fallback: Authorization: Bearer <access_token>
  const authH = req.headers.get("authorization") || "";
  console.log("[requireUser] bearer present", { present: authH.length > 0 });
  if (authH.toLowerCase().startsWith("bearer ")) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const sbBearer = createSupabaseClient(url, anon, {
      global: { headers: { Authorization: authH } },
    }) as unknown as SupabaseClient;
    const { data: u2, error: e2 } = await sbBearer.auth.getUser();
    console.log("[requireUser] bearer flow", {
      hasUser: !!u2?.user,
      err: e2?.message,
    });
    if (u2?.user) return { user: { id: u2.user.id }, sb: sbBearer };
  }

  // 3) No session found
  return {
    res: NextResponse.json(
      { ok: false, code: "UNAUTHORIZED" },
      { status: 401 }
    ),
  };
}
