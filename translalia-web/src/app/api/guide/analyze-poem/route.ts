// app/api/guide/analyze-poem/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import {
  detectChunksLocal,
  detectStanzasLocal,
} from "@/lib/poem/chunkDetection";
import {
  createTranslationJob,
  getTranslationJob,
} from "@/lib/workshop/jobState";
import { runTranslationTick } from "@/lib/workshop/runTranslationTick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  poem: z.string().min(1, "poem is required"),
  threadId: z.string().min(1, "threadId is required"),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json<T>(data, { status });
}
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
    console.log("[/api/guide/analyze-poem]", requestId, ...a);

  try {
    // 1) Parse & validate body
    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await req.json());
      log("body ok", { threadId: body.threadId, poemLen: body.poem?.length });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log("bad body", message);
      return err(400, "BAD_BODY", "Invalid request body", {
        details: message,
      });
    }

    // 2) Auth (Supabase, Node runtime is required)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set() {},
          remove() {},
        },
      }
    );
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (authErr || !user) {
      log("unauthenticated", authErr?.message);
      return err(401, "UNAUTHENTICATED", "Please sign in to analyze.");
    }

    // 3) Thread ownership
    const { data: thread, error: threadErr } = await supabase
      .from("chat_threads")
      .select("id,created_by,state")
      .eq("id", body.threadId)
      .single();

    if (threadErr || !thread) {
      log("thread_not_found", threadErr?.message);
      return err(404, "THREAD_NOT_FOUND", "Thread not found.");
    }
    if (thread.created_by !== user.id) {
      log("forbidden", { userId: user.id, owner: thread.created_by });
      return err(403, "FORBIDDEN", "You do not have access to this thread.");
    }

    // 4) Poem analysis removed - no longer using LLM analysis
    // Client-side stanza detection is now used instead
    // Return minimal analysis object for backward compatibility
    const analysis = {
      language: "unknown",
      wordCount: body.poem.trim().split(/\s+/).length,
      summary: "",
      tone: [],
      dialect: null,
      themes: [],
      keyImages: [],
    };

    // 5) Detect chunks locally (splits at semantic boundaries, ~4 lines per chunk)
    const chunkResult = detectChunksLocal(body.poem);
    // Convert to legacy format for backward compatibility
    const stanzaResult = {
      stanzas: chunkResult.chunks,
      totalStanzas: chunkResult.totalChunks,
      detectionMethod: chunkResult.detectionMethod,
      reasoning: chunkResult.reasoning,
    };
    log("chunk_detection", {
      totalChunks: chunkResult.totalChunks,
      totalStanzas: stanzaResult.totalStanzas, // Legacy field
      method: chunkResult.detectionMethod,
    });

    // 6) Persist (don't block UI on save failure)
    // Merge with existing state to preserve other fields (guide_answers, workshop_lines, etc.)
    const currentState = (thread.state as Record<string, unknown>) || {};
    const newState = {
      ...currentState,
      poem_analysis: analysis,
      raw_poem: body.poem, // Store original poem text
      poem_stanzas: stanzaResult, // Store stanza structure
    };
    const { error: saveErr } = await supabase
      .from("chat_threads")
      .update({ state: newState })
      .eq("id", body.threadId);

    if (saveErr) {
      log("save_fail", saveErr.message);
      return ok({ analysis, saved: false });
    }

    let translationJobSummary: {
      status: string;
      completed: number;
      total: number;
      queueLength: number;
    } | null = null;

    try {
      const job = await createTranslationJob(
        {
          threadId: body.threadId,
          poem: body.poem,
          chunks: stanzaResult.stanzas, // stanzaResult.stanzas are actually chunks now
          stanzas: stanzaResult.stanzas, // Legacy fallback for backward compatibility
        },
        {
          guidePreferences: currentState.guide_answers as
            | Record<string, unknown>
            | undefined,
        }
      );

      if (job.status === "pending") {
        await runTranslationTick(body.threadId, {
          maxProcessingTimeMs: 4000,
        });
      }

      const updatedJob = await getTranslationJob(body.threadId);
      if (updatedJob) {
        // Use chunks (new) or stanzas (legacy) for progress tracking
        const chunksOrStanzas = updatedJob.chunks || updatedJob.stanzas || {};
        const total = Object.keys(chunksOrStanzas).length;
        const completed = Object.values(chunksOrStanzas).filter(
          (chunk) => chunk.status === "completed"
        ).length;
        translationJobSummary = {
          status: updatedJob.status,
          completed,
          total,
          queueLength: updatedJob.queue.length,
        };
      }
    } catch (jobError: unknown) {
      console.error(
        "[/api/guide/analyze-poem] Failed to initialize background translations",
        jobError
      );
    }

    log("success", { ms: Date.now() - started });
    return ok({
      analysis,
      saved: true,
      translationJob: translationJobSummary,
    });
  } catch (e: unknown) {
    console.error("[/api/guide/analyze-poem] fatal", e);
    const message = e instanceof Error ? e.message : String(e);
    return err(500, "INTERNAL", "Internal server error", { details: message });
  }
}
