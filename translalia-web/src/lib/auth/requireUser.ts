import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/** Ensures a user session exists; returns 401 JSON response otherwise. */
export async function requireUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return {
      user: null as any,
      response: NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 }
      ),
    };
  }
  return { user: data.user, response: null as any };
}
