/**
 * API endpoint for generating poem-level (macro) suggestions
 *
 * This endpoint helps students think about their translation holistically
 * after completing line-by-line work in the Workshop phase.
 *
 * POST /api/notebook/poem-suggestions
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { z } from "zod";
import { responsesCall } from "@/lib/ai/openai";
import { TRANSLATOR_MODEL } from "@/lib/models";
import {
  buildPoetryMacroSystemPrompt,
  buildPoetryMacroUserPrompt,
  parsePoetryMacroCritiqueResponse,
  generateFallbackSuggestions,
} from "@/lib/ai/poemSuggestions";
import type { PoetryMacroCritiqueResponse } from "@/types/poemSuggestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  sourcePoem: z.string().min(10, "Source poem too short"),
  translationPoem: z.string().min(10, "Translation too short"),
  guideAnswers: z.record(z.unknown()).optional(),
});

function err(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

function ok<T>(data: T, status = 200) {
  return NextResponse.json<T>(data, { status });
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...a: unknown[]) =>
    console.log("[/api/notebook/poem-suggestions]", requestId, ...a);

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
        sourcePoemLen: body.sourcePoem?.length,
        translationLen: body.translationPoem?.length,
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
      .select("id, created_by")
      .eq("id", body.threadId)
      .eq("created_by", user.id)
      .single();

    if (threadErr || !thread) {
      log("thread_not_found", threadErr?.message);
      return err(404, "THREAD_NOT_FOUND", "Thread not found or unauthorized");
    }

    // 4) Call LLM for macro critique
    log("calling_llm_for_macro_critique");

    const systemPrompt = buildPoetryMacroSystemPrompt(body.guideAnswers as any);
    const userPrompt = buildPoetryMacroUserPrompt(
      body.sourcePoem,
      body.translationPoem
    );

    const llmResponse = await responsesCall({
      model: TRANSLATOR_MODEL,
      system: systemPrompt,
      user: userPrompt,
      auditContext: {
        createdBy: user.id,
        threadId: body.threadId,
        stage: "notebook:poem-suggestions",
        provider: "openai",
      },
    });

    log("llm_response ok");

    // 5) Extract and parse response
    const responseText = typeof llmResponse === "string" ? llmResponse : JSON.stringify(llmResponse);

    let parsedResponse: PoetryMacroCritiqueResponse | null = null;

    // Try to extract JSON from response (it might be wrapped in markdown)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedResponse = parsePoetryMacroCritiqueResponse(jsonMatch[0]);
    }

    // Fall back to heuristic-based suggestions if LLM parsing fails
    if (!parsedResponse) {
      log("llm_parse_failed_using_fallback");
      parsedResponse = generateFallbackSuggestions(
        body.sourcePoem,
        body.translationPoem
      );
    }

    log("success", {
      ms: Date.now() - started,
      suggestionCount: parsedResponse.suggestions.length,
    });

    return ok<PoetryMacroCritiqueResponse>(parsedResponse);
  } catch (e: unknown) {
    console.error("[/api/notebook/poem-suggestions] fatal", e);
    const errorMsg =
      e instanceof Error ? e.message : "Internal server error";
    return err(500, "INTERNAL", errorMsg);
  }
}
