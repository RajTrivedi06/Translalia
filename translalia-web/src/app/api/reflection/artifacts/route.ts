import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  parseJourneySummary,
  parseRefineRhymeState,
  parseTranslationInsights,
  type ReflectionArtifactsResponse,
} from "@/lib/reflection/artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GetQuerySchema = z.object({
  threadId: z.string().uuid(),
});

function ok(data: ReflectionArtifactsResponse, status = 200) {
  return NextResponse.json(data, { status });
}

function err(status: number, code: string, message: string, extra?: object) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * GET /api/reflection/artifacts?threadId=...
 * Load persisted editing-rail AI artifacts for hydration on page refresh:
 *   state.translation_insights, state.refine_rhyme, latest journey_ai_summaries row.
 */
export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (...a: unknown[]) =>
    console.log("[/api/reflection/artifacts] GET", requestId, ...a);

  try {
    const { user, response } = await requireUser();
    if (!user) {
      log("unauthorized");
      return response;
    }

    const { searchParams } = new URL(req.url);
    let validatedQuery: z.infer<typeof GetQuerySchema>;
    try {
      validatedQuery = GetQuerySchema.parse({
        threadId: searchParams.get("threadId"),
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log("bad query", message);
      return err(400, "BAD_QUERY", "Invalid query parameters", {
        details: message,
      });
    }

    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state, created_by")
      .eq("id", validatedQuery.threadId)
      .single();

    if (threadError || !thread) {
      log("thread_not_found", threadError?.message);
      return err(404, "THREAD_NOT_FOUND", "Thread not found.");
    }

    if (thread.created_by !== user.id) {
      log("forbidden", { userId: user.id, owner: thread.created_by });
      return err(403, "FORBIDDEN", "You do not have access to this thread.");
    }

    const state = (thread.state as Record<string, unknown>) || {};
    const translationInsights = parseTranslationInsights(
      state.translation_insights
    );
    const refineRhyme = parseRefineRhymeState(state.refine_rhyme);

    const { data: journeyRow, error: journeyError } = await supabase
      .from("journey_ai_summaries")
      .select(
        "reflection_text, insights, strengths, challenges, recommendations, created_at"
      )
      .eq("thread_id", validatedQuery.threadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (journeyError) {
      log("journey_fetch_failed", journeyError.message);
      return err(500, "DB_ERROR", "Failed to load journey summary.", {
        details: journeyError.message,
      });
    }

    const journeySummary = journeyRow ? parseJourneySummary(journeyRow) : null;

    log("success", {
      hasTranslationInsights: !!translationInsights,
      hasRefineRhyme: !!refineRhyme,
      hasJourneySummary: !!journeySummary,
    });

    return ok({
      translationInsights,
      refineRhyme,
      journeySummary,
    });
  } catch (e: unknown) {
    console.error("[/api/reflection/artifacts] GET fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
