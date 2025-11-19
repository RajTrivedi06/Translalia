import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";
import { createMessageSchema } from "@/lib/schemas";

// POST /api/chat/[threadId]/messages
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;

  // Extract threadId from URL: /api/chat/[threadId]/messages
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const chatIdx = segments.indexOf("chat");
  const threadId = chatIdx >= 0 ? segments[chatIdx + 1] : undefined;
  const parsed = createMessageSchema.safeParse(await req.json());
  if (!parsed.success || !threadId) {
    return NextResponse.json(
      { error: parsed.success ? "Missing threadId" : parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = await guard.sb
    .from("chat_messages")
    .insert({
      project_id: parsed.data.projectId,
      thread_id: threadId,
      role: parsed.data.role ?? "user",
      content: parsed.data.content,
      meta: parsed.data.meta ?? {},
      created_by: guard.user.id,
    })
    .select("id, created_at")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(
    { id: data.id, created_at: data.created_at },
    { status: 201 }
  );
}
