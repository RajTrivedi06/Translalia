import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

const Q = z.object({
  projectId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

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

    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("journey_items")
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
