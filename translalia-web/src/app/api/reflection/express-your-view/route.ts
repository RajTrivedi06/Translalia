import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { patchThreadStateField } from "@/server/guide/updateGuideState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Matches ThreadNotesEditor's maxLength so client and server agree.
const MAX_LENGTH = 5000;

const GetQuerySchema = z.object({
  threadId: z.string().uuid(),
});

const PostBodySchema = z.object({
  threadId: z.string().uuid(),
  expressYourView: z.string().max(MAX_LENGTH).nullable(),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as any, { status });
}

function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * GET /api/reflection/express-your-view?threadId=...
 * Fetch the student's post-AI reflection from chat_threads.state.express_your_view.
 */
export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (...a: any[]) =>
    console.log("[/api/reflection/express-your-view] GET", requestId, ...a);

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

    // 5) Extract reflection from state (default null if missing)
    const state = (thread.state as any) || {};
    const expressYourView =
      typeof state.express_your_view === "string"
        ? state.express_your_view
        : null;

    log("success", { hasReflection: !!expressYourView });

    return ok({ expressYourView });
  } catch (e: any) {
    console.error("[/api/reflection/express-your-view] GET fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}

/**
 * POST /api/reflection/express-your-view
 * Save the student's post-AI reflection to chat_threads.state.express_your_view
 * using an atomic JSONB patch. Does NOT touch notebook_notes.
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...a: any[]) =>
    console.log("[/api/reflection/express-your-view] POST", requestId, ...a);

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
        length: body.expressYourView?.length ?? 0,
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
      .select("id, created_by")
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

    // 4) Atomic patch of the single string field (null clears it)
    const patchResult = await patchThreadStateField(
      body.threadId,
      ["express_your_view"],
      body.expressYourView
    );

    if (!patchResult.success) {
      log("patch_failed", patchResult.error);
      return err(500, "UPDATE_FAILED", "Failed to save reflection.", {
        details: patchResult.error,
      });
    }

    log("success", {
      ms: Date.now() - started,
      hasReflection: !!body.expressYourView,
    });

    return ok({ expressYourView: body.expressYourView });
  } catch (e: any) {
    console.error("[/api/reflection/express-your-view] POST fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
