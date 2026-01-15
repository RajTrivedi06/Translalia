import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { patchThreadStateField } from "@/server/guide/updateGuideState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GetQuerySchema = z.object({
  threadId: z.string().uuid(),
});

const PostBodySchema = z.object({
  threadId: z.string().uuid(),
  threadNote: z.string().nullable().optional(),
  lineNotes: z.record(z.number(), z.string()).optional(),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as any, { status });
}

function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * GET /api/notebook/notes?threadId=...
 * Fetch notes for a thread from chat_threads.state.notebook_notes
 */
export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (...a: any[]) =>
    console.log("[/api/notebook/notes] GET", requestId, ...a);

  try {
    // 1) Check authentication
    const { user, response } = await requireUser();
    if (!user) {
      log("unauthorized");
      return response;
    }

    // 2) Parse query params
    const { searchParams } = new URL(req.url);
    const query = {
      threadId: searchParams.get("threadId"),
    };

    let validatedQuery: z.infer<typeof GetQuerySchema>;
    try {
      validatedQuery = GetQuerySchema.parse(query);
    } catch (e: any) {
      log("bad query", e?.message);
      return err(400, "BAD_QUERY", "Invalid query parameters", {
        details: String(e?.message ?? e),
      });
    }

    // 3) Fetch thread state
    const supabase = await supabaseServer();
    const { data: thread, error: fetchError } = await supabase
      .from("chat_threads")
      .select("id, state, created_by")
      .eq("id", validatedQuery.threadId)
      .single();

    if (fetchError || !thread) {
      log("thread_not_found", fetchError?.message);
      return err(404, "THREAD_NOT_FOUND", "Thread not found.");
    }

    // 4) Verify ownership
    if (thread.created_by !== user.id) {
      log("forbidden", { userId: user.id, owner: thread.created_by });
      return err(403, "FORBIDDEN", "You do not have access to this thread.");
    }

    // 5) Extract notes from state
    const state = (thread.state as any) || {};
    const notebookNotes = state.notebook_notes || {
      thread_note: null,
      line_notes: {},
      updated_at: null,
    };

    log("success", {
      hasThreadNote: !!notebookNotes.thread_note,
      lineNotesCount: Object.keys(notebookNotes.line_notes || {}).length,
    });

    return ok({
      threadNote: notebookNotes.thread_note || null,
      lineNotes: notebookNotes.line_notes || {},
      updatedAt: notebookNotes.updated_at || null,
    });
  } catch (e: any) {
    console.error("[/api/notebook/notes] GET fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}

/**
 * POST /api/notebook/notes
 * Save notes to chat_threads.state.notebook_notes using atomic update
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...a: any[]) =>
    console.log("[/api/notebook/notes] POST", requestId, ...a);

  try {
    // 1) Check authentication
    const { user, response } = await requireUser();
    if (!user) {
      log("unauthorized");
      return response;
    }

    // 2) Parse & validate body
    let body: z.infer<typeof PostBodySchema>;
    try {
      body = PostBodySchema.parse(await req.json());
      log("body ok", {
        threadId: body.threadId,
        hasThreadNote: body.threadNote !== undefined,
        hasLineNotes: !!body.lineNotes,
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

    // 4) Get current notes state to merge
    const currentState = (thread.state as any) || {};
    const currentNotes = currentState.notebook_notes || {
      thread_note: null,
      line_notes: {},
      updated_at: null,
    };

    // 5) Merge new notes with existing
    const updatedNotes = {
      thread_note:
        body.threadNote !== undefined
          ? body.threadNote
          : currentNotes.thread_note,
      line_notes: body.lineNotes
        ? { ...currentNotes.line_notes, ...body.lineNotes }
        : currentNotes.line_notes,
      updated_at: new Date().toISOString(),
    };

    // 6) Update using atomic patch
    const patchResult = await patchThreadStateField(
      body.threadId,
      ["notebook_notes"],
      updatedNotes
    );

    if (!patchResult.success) {
      log("patch_failed", patchResult.error);
      return err(500, "UPDATE_FAILED", "Failed to save notes.", {
        details: patchResult.error,
      });
    }

    log("success", {
      ms: Date.now() - started,
      hasThreadNote: !!updatedNotes.thread_note,
      lineNotesCount: Object.keys(updatedNotes.line_notes).length,
    });

    return ok({
      threadNote: updatedNotes.thread_note,
      lineNotes: updatedNotes.line_notes,
      updatedAt: updatedNotes.updated_at,
    });
  } catch (e: any) {
    console.error("[/api/notebook/notes] POST fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
