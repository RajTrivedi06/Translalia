import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

const Q = z.object({
  projectId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = Q.safeParse({
      projectId: url.searchParams.get("projectId"),
      limit: url.searchParams.get("limit") ?? "20",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { projectId, limit } = parsed.data;

    // Prefer Bearer token from Authorization header, else fall back to cookie-based client
    const hdrs = await headers();
    const auth = hdrs.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;

    const supabase = token
      ? createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        })
      : await supabaseServer();
    const { data, error } = await supabase
      .from("journey_items_archive")
      .select("id, kind, summary, meta, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: unknown) {
    const message = (e as { message?: string })?.message || "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
