import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";
import { createProjectSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (guard.res) return guard.res;
  const parsed = createProjectSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const sb = guard.sb;
  const safeTitle =
    (parsed.data.title ?? "Untitled Workspace").trim() || "Untitled Workspace";
  const { data, error } = await sb
    .from("projects")
    .insert({
      title: safeTitle.slice(0, 120),
      owner_id: guard.user.id,
      src_lang: parsed.data.src_lang ?? null,
      tgt_langs: parsed.data.tgt_langs ?? null,
    })
    .select("id, title, created_at")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ project: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireUser(req);
  if (guard.res) return guard.res;

  const { id, projectId } = await req.json().catch(() => ({ id: undefined }));
  const targetId = id || projectId;
  if (!targetId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await guard.sb
    .from("projects")
    .delete()
    .eq("id", targetId)
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
