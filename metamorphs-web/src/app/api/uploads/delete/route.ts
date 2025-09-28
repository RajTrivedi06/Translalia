// src/app/api/uploads/delete/route.ts
import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabaseServer";
import { BUCKET } from "@/lib/storagePath";
import { removeObject } from "@/lib/storage";

export const runtime = "nodejs";

type Body = { path: string };

export async function POST(req: Request) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    if (!body?.path) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (!body.path.startsWith(`${BUCKET}/`)) {
      return NextResponse.json(
        { error: "Invalid bucket path" },
        { status: 400 }
      );
    }

    // Ownership check by prefix: corpora/{user.id}/...
    const requiredPrefix = `${BUCKET}/${user.id}/`;
    if (!body.path.startsWith(requiredPrefix)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await removeObject(body.path);

    // Best-effort: delete row from uploads table
    await supabase
      .from("uploads")
      .delete()
      .eq("user_id", user.id)
      .eq("storage_path", body.path);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
