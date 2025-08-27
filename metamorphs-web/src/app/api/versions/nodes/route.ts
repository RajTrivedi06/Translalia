import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get("threadId");
  if (!threadId)
    return NextResponse.json(
      { ok: false, error: "MISSING_THREAD_ID" },
      { status: 400 }
    );

  const guard = await requireUser(req);
  if (guard.res) return guard.res;
  const sb = guard.sb;

  const { data: th, error: thErr } = await sb
    .from("chat_threads")
    .select("id, project_id")
    .eq("id", threadId)
    .single();
  if (thErr || !th) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN_OR_NOT_FOUND" },
      { status: 403 }
    );
  }

  const { data, error } = await sb
    .from("versions")
    .select("id, tags, meta, created_at")
    .eq("project_id", th.project_id)
    .filter("meta->>thread_id", "eq", threadId)
    .order("created_at", { ascending: true });
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );

  const list = (data || []).map((r: any) => ({
    id: r.id as string,
    display_label: r.meta?.display_label ?? null,
    status: (r.meta?.status as "placeholder" | "generated") ?? "generated",
    parent_version_id: (r.meta?.parent_version_id as string | null) ?? null,
    overview: (r.meta?.overview as any) ?? null,
    complete: !!(r.meta?.complete as boolean | undefined),
    created_at: r.created_at as string,
  }));

  // Temporary log for debugging
  // eslint-disable-next-line no-console
  console.log("[nodes]", {
    threadId,
    count: data?.length || 0,
    user: guard.user?.id,
  });

  return NextResponse.json({
    ok: true,
    threadIdEcho: threadId,
    count: list.length,
    nodes: list,
  });
}
