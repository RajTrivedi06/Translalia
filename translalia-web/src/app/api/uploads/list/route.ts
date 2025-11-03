import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const supa = await getServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const threadId = url.searchParams.get("threadId") || null;

  let q = supa
    .from("uploads")
    .select("file_name, size_bytes, storage_path, created_at, thread_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (threadId) q = q.eq("thread_id", threadId);

  const { data, error } = await q;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    items: (data ?? []).map((r) => ({
      name: r.file_name,
      size: r.size_bytes ?? 0,
      path: r.storage_path ?? undefined,
      threadId: r.thread_id ?? null,
    })),
  });
}
