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
  console.log("[HIT] translation-status");
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

  // Read-only by default. If advance=true, run a tiny micro-tick as fallback
  // (worker should handle most processing, this is just for UI responsiveness)
  let tickResult = null;
  if (advance === "true") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 500, // Small budget, quality-safe (won't finalize partial lines)
    });
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

  return NextResponse.json(
    {
      ok: true,
      job,
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
