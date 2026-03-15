// TEMP DEBUG - REMOVE AFTER FIX
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth/requireUser";

function debugApiDisabled(): boolean {
  const explicitlyEnabled = process.env.DEBUG_API_ENABLED === "1";
  const productionLike =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";
  return productionLike && !explicitlyEnabled;
}

export async function GET() {
  if (debugApiDisabled()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { user, response } = await requireUser();
  if (!user) return response;

  const cookieStore = await cookies();
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  return NextResponse.json({
    cookie_names: cookieStore.getAll().map((c: { name: string }) => c.name),
    has_bearer: !!(await headers()).get("authorization"),
    uid: data?.user?.id ?? null,
  });
}
