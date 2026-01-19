import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { getTranslationJob } from "@/lib/workshop/jobState";
import { runTranslationTick } from "@/lib/workshop/runTranslationTick";
import { summarizeTranslationJob } from "@/lib/workshop/translationProgress";

// Force dynamic rendering - never cache this route
export const dynamic = "force-dynamic";
export const revalidate = 0;

const QuerySchema = z.object({
  threadId: z.string().uuid(),
  advance: z.enum(["true", "false"]).optional().default("true"),
});

export async function GET(req: NextRequest) {
  const routeStartTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  console.log(`[translation-status] ${requestId} start`);
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  let query: z.infer<typeof QuerySchema>;
  try {
    query = QuerySchema.parse(params);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details:
          error instanceof Error ? error.message : "Unable to parse request",
      },
      { status: 400 }
    );
  }

  const { threadId, advance } = query;

  const supabase = await supabaseServer();
  const { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select("id, created_by")
    .eq("id", threadId)
    .single();

  if (threadError || !thread) {
    return NextResponse.json(
      { error: "Thread not found or unauthorized" },
      { status: 404 }
    );
  }

  if (thread.created_by !== user.id) {
    return NextResponse.json(
      { error: "You do not have access to this thread" },
      { status: 403 }
    );
  }

  // ISS-002: Non-blocking tick trigger
  // Goal: Return quickly (<100-300ms) while still advancing work.
  // Architecture: Start tick with short timeout (200ms), return immediately if not done.
  // The existing Redis lock in runTranslationTick() prevents duplicate ticks.
  // Next poll will trigger another tick if needed.
  let tickResult = null;
  let tickScheduled = false;
  
  if (advance === "true") {
    // ISS-002: Short timeout for HTTP response (200ms max wait)
    // The tick itself has its own time budget (TICK_TIME_BUDGET_MS) for processing work
    const HTTP_RESPONSE_TIMEOUT_MS = Number(process.env.TRANSLATION_STATUS_TIMEOUT_MS) || 200;
    const TICK_TIME_BUDGET_MS = Number(process.env.TICK_TIME_BUDGET_MS) || 2500;
    
    // ISS-006: Configurable max stanzas per tick (with kill switch)
    const parallelStanzasEnabled = process.env.ENABLE_PARALLEL_STANZAS !== "0";
    const maxStanzasPerTick = parallelStanzasEnabled
      ? Math.min(
          Math.max(1, Number(process.env.MAX_STANZAS_PER_TICK) || 1),
          5
        )
      : 1;

    // Start tick without awaiting (fire-and-forget pattern with timeout)
    const tickPromise = runTranslationTick(threadId, {
      maxProcessingTimeMs: TICK_TIME_BUDGET_MS,
      maxStanzasPerTick,
    });

    // Race between tick completion and HTTP timeout
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), HTTP_RESPONSE_TIMEOUT_MS);
    });

    try {
      const raceStartTime = Date.now();
      const raceResult = await Promise.race([tickPromise, timeoutPromise]);
      const raceDuration = Date.now() - raceStartTime;
      
      if (raceResult !== null) {
        // Tick completed quickly (<200ms)
        tickResult = raceResult;
        console.log(
          `[translation-status] ${requestId} tick completed quickly: ${raceDuration}ms`
        );
      } else if (raceDuration < HTTP_RESPONSE_TIMEOUT_MS * 0.5) {
        // Race completed very quickly with null - likely lock was held (tick already running)
        // runTranslationTick() returns null immediately when lock is not acquired
        console.log(
          `[translation-status] ${requestId} tick skipped (lock held, already running): ${raceDuration}ms`
        );
        // tickResult remains null - response will include current state
      } else {
        // Timeout won - tick still running in background
        tickScheduled = true;
        console.log(
          `[translation-status] ${requestId} tick scheduled (timeout after ${HTTP_RESPONSE_TIMEOUT_MS}ms), returning immediately`
        );
        
        // Continue tick in background (fire-and-forget)
        // Note: In serverless, this may be cut off, but that's okay - next poll will trigger again
        tickPromise.catch((error) => {
          console.error(
            `[translation-status] ${requestId} background tick error:`,
            error instanceof Error ? error.message : String(error)
          );
        });
      }
    } catch (error) {
      // Tick failed quickly - log but don't block response
      console.error(
        `[translation-status] ${requestId} tick error:`,
        error instanceof Error ? error.message : String(error)
      );
      // tickResult remains null - response will still include current state
    }
  }

  const job = await getTranslationJob(threadId);
  const progress = summarizeTranslationJob(job);

  // Extract ready lines from job state (same source of truth as writer)
  // Return lines with translationStatus="translated" so UI can render them immediately
  // This avoids "jobState says X but UI says nothing" inconsistencies
  const readyLines: Array<{
    line_number: number;
    original_text: string;
    translations: import("@/types/lineTranslation").LineTranslationVariant[];
    model_used?: string;
    translationStatus?: "pending" | "translated" | "failed";
    alignmentStatus?: "pending" | "aligned" | "skipped" | "failed";
    quality_metadata?: {
      quality_tier?: "pass" | "salvage" | "failed";
      phase1Pass?: boolean;
      gatePass?: boolean;
      regenPerformed?: boolean;
    };
    updated_at?: number;
  }> = [];

  if (job) {
    const chunkOrStanzaStates = job.chunks || job.stanzas || {};
    Object.values(chunkOrStanzaStates).forEach((stanza) => {
      const lines = stanza.lines || [];
      lines.forEach((line) => {
        // Include lines with translationStatus="translated" (ready to show)
        if (line.translationStatus === "translated") {
          readyLines.push({
            line_number: line.line_number,
            original_text: line.original_text,
            translations: line.translations,
            model_used: line.model_used,
            translationStatus: line.translationStatus,
            alignmentStatus: line.alignmentStatus,
            quality_metadata: line.quality_metadata
              ? {
                  quality_tier: line.quality_metadata.quality_tier,
                  phase1Pass: line.quality_metadata.phase1Pass,
                  gatePass: line.quality_metadata.gatePass,
                  regenPerformed: line.quality_metadata.regenPerformed,
                }
              : undefined,
            updated_at: line.updated_at,
          });
        }
      });
    });
  }

  const routeDuration = Date.now() - routeStartTime;
  const tickStatus = tickResult 
    ? "completed" 
    : tickScheduled 
    ? "scheduled" 
    : advance === "true" 
    ? "skipped" 
    : "none";
  console.log(
    `[translation-status] ${requestId} returning: duration=${routeDuration}ms, tick=${tickStatus}`
  );

  return NextResponse.json(
    {
      ok: true,
      job,
      // ISS-002: Maintain backwards compatibility - tick field always present
      // If tick completed quickly, return result; otherwise return null (tick continues in background)
      tick: tickResult,
      progress,
      readyLines, // Lines with translationStatus="translated"
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
