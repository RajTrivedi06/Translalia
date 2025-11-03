import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { ok: false, code: "MISSING_PROJECT_ID" },
      { status: 400 }
    );
  }

  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
  const { user, sb } = guard;

  const { data: proj } = await sb
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .single();
  if (!proj)
    return NextResponse.json(
      { ok: false, code: "PROJECT_NOT_FOUND" },
      { status: 404 }
    );
  if (proj.owner_id !== user.id) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN_PROJECT" },
      { status: 403 }
    );
  }

  const { data, error } = await sb
    .from("chat_threads")
    .select("id, title, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );

  return NextResponse.json({ ok: true, items: data || [] });
}
