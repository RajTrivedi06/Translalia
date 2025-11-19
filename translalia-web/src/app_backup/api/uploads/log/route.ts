// src/app/api/uploads/log/route.ts
import { NextResponse } from "next/server";
import { logUpload } from "@/server/uploads/logUpload";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.storage_path || !body?.file_name) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await logUpload({
      storage_path: body.storage_path,
      file_name: body.file_name,
      mime_type: body.mime_type ?? null,
      size_bytes: body.size_bytes ?? null,
      thread_id: body.thread_id ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
