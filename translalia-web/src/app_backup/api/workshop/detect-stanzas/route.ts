// app/api/workshop/detect-stanzas/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { z } from "zod";
import {
  detectChunksLocal,
  detectStanzasLocal,
} from "@/lib/poem/chunkDetection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  poemText: z.string().min(1),
  metadata: z
    .object({
      title: z.string().optional(),
      author: z.string().optional(),
      style: z.string().optional(),
    })
    .optional(),
});

function err(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...a: unknown[]) =>
    console.log("[/api/workshop/detect-stanzas]", requestId, ...a);

  try {
    // 1) Auth check
    const { user, response } = await requireUser();
    if (!user) return response;

    // 2) Parse & validate body
    let body: z.infer<typeof RequestSchema>;
    try {
      body = RequestSchema.parse(await req.json());
      log("body ok", {
        threadId: body.threadId,
        poemLen: body.poemText?.length,
      });
    } catch (e: unknown) {
      const errorMessage =
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : String(e);
      log("bad body", errorMessage);
      return err(400, "BAD_BODY", "Invalid request body", {
        details: errorMessage,
      });
    }

    // 3) Verify thread ownership
    const supabase = await supabaseServer();
    const { data: thread, error: threadErr } = await supabase
      .from("chat_threads")
      .select("id, created_by, state")
      .eq("id", body.threadId)
      .eq("created_by", user.id)
      .single();

    if (threadErr || !thread) {
      log("thread_not_found", threadErr?.message);
      return err(404, "THREAD_NOT_FOUND", "Thread not found or unauthorized");
    }

    // 4) Use local chunk detection (splits at semantic boundaries, ~4 lines per chunk)
    log("using_local_chunk_detection");
    const chunkResult = detectChunksLocal(body.poemText);
    // Convert to legacy format for backward compatibility (chunks → stanzas)
    const localResult = {
      stanzas: chunkResult.chunks,
      totalStanzas: chunkResult.totalChunks,
      detectionMethod: chunkResult.detectionMethod,
      reasoning: chunkResult.reasoning,
    };

    // 5) Save result to state
    const currentState = (thread.state as Record<string, unknown>) || {};
    const newState = {
      ...currentState,
      raw_poem: body.poemText,
      poem_stanzas: localResult,
    };

    const { error: saveErr } = await supabase
      .from("chat_threads")
      .update({ state: newState })
      .eq("id", body.threadId);

    if (saveErr) {
      log("save_fail", saveErr.message);
    }

    log("success", { ms: Date.now() - started, method: "local" });
    return NextResponse.json(localResult);
  } catch (e: unknown) {
    console.error("[/api/workshop/detect-stanzas] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
