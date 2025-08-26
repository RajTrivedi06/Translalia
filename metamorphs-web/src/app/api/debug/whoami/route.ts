// TEMP DEBUG - REMOVE AFTER FIX
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  return NextResponse.json({
    cookie_names: cookieStore.getAll().map((c: { name: string }) => c.name),
    has_bearer: !!(await headers()).get("authorization"),
    uid: data?.user?.id ?? null,
  });
}
