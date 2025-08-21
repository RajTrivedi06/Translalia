import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";
import { createThreadSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (guard.res) return guard.res;
  const parsed = createThreadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { projectId, title } = parsed.data;

  const fallback =
    "Chat – " +
    new Date().toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "2-digit",
    });

  const { data, error } = await guard.sb
    .from("chat_threads")
    .insert({
      project_id: projectId,
      title: (title ?? fallback).toString().slice(0, 120),
      created_by: guard.user.id,
    })
    .select("id, title, created_at")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ thread: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireUser(req);
  if (guard.res) return guard.res;

  const { id, threadId } = await req.json().catch(() => ({ id: undefined }));
  const targetId = id || threadId;
  if (!targetId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await guard.sb
    .from("chat_threads")
    .delete()
    .eq("id", targetId)
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
