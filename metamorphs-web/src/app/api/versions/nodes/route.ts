import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get("threadId");
  if (!threadId)
    return NextResponse.json(
      { ok: false, error: "MISSING_THREAD_ID" },
      { status: 400 }
    );

  const supabase = await supabaseServer();

  const { data: rows, error } = await supabase
    .from("versions")
    .select("id, project_id, lines, meta, created_at")
    .filter("meta->>thread_id", "eq", threadId)
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );

  const list = (rows || []).map((r: any) => ({
    id: r.id as string,
    display_label: r.meta?.display_label ?? null,
    status: (r.meta?.status as "placeholder" | "generated") ?? "generated",
    parent_version_id: (r.meta?.parent_version_id as string | null) ?? null,
    overview: (r.meta?.overview as any) ?? null,
    complete: !!(r.meta?.complete as boolean | undefined),
    created_at: r.created_at as string,
  }));

  return NextResponse.json({
    ok: true,
    threadIdEcho: threadId,
    count: list.length,
    nodes: list,
  });
}
