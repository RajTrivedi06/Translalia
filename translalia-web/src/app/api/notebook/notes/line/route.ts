import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { patchThreadStateField } from "@/server/guide/updateGuideState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  content: z.string().nullable(),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as any, { status });
}

function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * POST /api/notebook/notes/line
 * Save a single line note atomically
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...a: any[]) =>
    console.log("[/api/notebook/notes/line] POST", requestId, ...a);

  try {
    // 1) Check authentication
    const { user, response } = await requireUser();
    if (!user) {
      log("unauthorized");
      return response;
    }

    // 2) Parse & validate body
    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await req.json());
      log("body ok", {
        threadId: body.threadId,
        lineIndex: body.lineIndex,
        hasContent: body.content !== null && body.content !== "",
      });
    } catch (e: any) {
      log("bad body", e?.message);
      return err(400, "BAD_BODY", "Invalid request body", {
        details: String(e?.message ?? e),
      });
    }

    // 3) Verify thread exists and user owns it
    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, created_by, state")
      .eq("id", body.threadId)
      .single();

    if (threadError || !thread) {
      log("thread_not_found", threadError?.message);
      return err(404, "THREAD_NOT_FOUND", "Thread not found.");
    }

    if (thread.created_by !== user.id) {
      log("forbidden", { userId: user.id, owner: thread.created_by });
      return err(403, "FORBIDDEN", "You do not have access to this thread.");
    }

    // 4) Get current notes state
    const currentState = (thread.state as any) || {};
    const currentNotes = currentState.notebook_notes || {
      thread_note: null,
      line_notes: {},
      updated_at: null,
    };

    // 5) Update line note
    const updatedLineNotes = { ...currentNotes.line_notes };
    if (body.content === null || body.content.trim() === "") {
      delete updatedLineNotes[body.lineIndex];
    } else {
      updatedLineNotes[body.lineIndex] = body.content;
    }

    // 6) Merge with existing notes
    const updatedNotes = {
      thread_note: currentNotes.thread_note,
      line_notes: updatedLineNotes,
      updated_at: new Date().toISOString(),
    };

    // 7) Update using atomic patch
    const patchResult = await patchThreadStateField(
      body.threadId,
      ["notebook_notes"],
      updatedNotes
    );

    if (!patchResult.success) {
      log("patch_failed", patchResult.error);
      return err(500, "UPDATE_FAILED", "Failed to save line note.", {
        details: patchResult.error,
      });
    }

    log("success", {
      ms: Date.now() - started,
      lineIndex: body.lineIndex,
      hasContent: body.content !== null && body.content !== "",
    });

    return ok({
      lineIndex: body.lineIndex,
      content: body.content,
      updatedAt: updatedNotes.updated_at,
    });
  } catch (e: any) {
    console.error("[/api/notebook/notes/line] POST fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
