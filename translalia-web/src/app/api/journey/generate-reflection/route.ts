import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import OpenAI from "openai";
import { createServerClient } from "@supabase/ssr";
import { ENHANCER_MODEL } from "@/lib/models";
import { maskPrompts } from "@/server/audit/mask";
import { insertPromptAudit } from "@/server/audit/insertPromptAudit";
import {
  getSystemPrompt,
  getLanguageInstruction,
} from "@/lib/ai/localePrompts";
import { formatNotebookNotesForPrompt } from "@/lib/ai/workshopPrompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  context: z.object({
    poemLines: z.array(z.string()),
    completedLines: z.record(z.string()),
    totalLines: z.number(),
    completedCount: z.number(),
    guideAnswers: z.object({}).passthrough(),
    translationZone: z.string().nullable().optional(),
    translationIntent: z.string().nullable().optional(),
    progressPercentage: z.number(),
  }),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as any, { status });
}

function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...a: any[]) =>
    console.log("[/api/journey/generate-reflection]", requestId, ...a);

  try {
    // 1) Parse & validate body
    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await req.json());
      log("body ok", {
        threadId: body.threadId,
        totalLines: body.context.totalLines,
        completed: body.context.completedCount,
      });
    } catch (e: any) {
      log("bad body", e?.message);
      return err(400, "BAD_BODY", "Invalid request body", {
        details: String(e?.message ?? e),
      });
    }

    // 2) Auth
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
      return err(
        401,
        "UNAUTHENTICATED",
        "Please sign in to generate journey summary."
      );
    }

    // 3) Thread ownership and fetch state (including notes)
    const { data: thread, error: threadErr } = await supabase
      .from("chat_threads")
      .select("id,created_by,project_id,state")
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

    // 3a) Fetch user's locale preference
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("locale")
      .eq("id", user.id)
      .single();

    if (profileErr) {
      log("profile_fetch_error", profileErr?.message);
      log("proceeding with default locale");
    }
    const userLocale = profile?.locale || "en";
    log("user_locale", { locale: userLocale, hasProfile: !!profile });

    // 3b) Extract notes from thread state
    const state = (thread.state as any) || {};
    const notebookNotes = state.notebook_notes || {
      thread_note: null,
      line_notes: {},
      updated_at: null,
    };
    log("notes_extracted", {
      hasThreadNote: !!notebookNotes.thread_note,
      lineNotesCount: Object.keys(notebookNotes.line_notes || {}).length
    });

    // 4) OpenAI call for journey reflection
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      log("openai_key_missing");
      return err(500, "OPENAI_KEY_MISSING", "Server missing OpenAI API key.");
    }
    const openai = new OpenAI({ apiKey: key });

    // Build prompt for journey reflection
    const { context } = body;
    const completedLinesText = Object.entries(context.completedLines)
      .map(
        ([idx, text]) =>
          `Line ${parseInt(idx) + 1}: ${
            context.poemLines[parseInt(idx)]
          } → ${text}`
      )
      .join("\n");

    // Extract translation zone and intent with fallback logic
    const translationZone = (context.guideAnswers as any)?.translationZone?.trim?.() || context.translationZone?.trim?.() || "";
    const translationIntent = (context.guideAnswers as any)?.translationIntent?.trim?.() || context.translationIntent?.trim?.() || "";
    const translationStrategy = translationZone || translationIntent || "Not specified";

    // Format notes for inclusion in prompt
    const completedLinesRecord: Record<number, string> = {};
    Object.entries(context.completedLines).forEach(([idx, text]) => {
      completedLinesRecord[parseInt(idx)] = text;
    });

    const notesSection = formatNotebookNotesForPrompt(
      notebookNotes,
      context.poemLines,
      completedLinesRecord
    );

    const systemPrompt = getSystemPrompt("journeyReflection", userLocale);

    const baseUserPrompt = `Translation Journey Context:

Progress: ${context.completedCount}/${context.totalLines} lines (${
      context.progressPercentage
    }%)

Translation Strategy: ${translationStrategy}

Guide Answers: ${JSON.stringify(context.guideAnswers, null, 2)}

Completed Translations:
${completedLinesText || "No lines completed yet"}
${notesSection}

Please provide a reflective journey summary focusing on the translator's process, growth, and decisions (NOT a quality comparison of source vs translation). If the student has written notes, pay special attention to their reflections and incorporate their thinking process into the summary.`;

    const userPrompt = `${baseUserPrompt}\n\n${getLanguageInstruction(userLocale)}`;

    let modelToUse = ENHANCER_MODEL;
    let completion;

    const isGpt5 = modelToUse.startsWith("gpt-5");

    try {
      log("openai_attempt", { model: modelToUse, isGpt5 });

      if (isGpt5) {
        completion = await openai.chat.completions.create({
          model: modelToUse,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
      } else {
        completion = await openai.chat.completions.create({
          model: modelToUse,
          temperature: 0.7, // Higher temperature for more creative reflection
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
      }
    } catch (modelError: any) {
      const shouldFallback =
        modelError?.error?.code === "model_not_found" ||
        modelError?.status === 404 ||
        modelError?.status === 400;

      if (shouldFallback) {
        log("fallback_to_gpt4", {
          from: modelToUse,
          to: "gpt-4o-mini",
          reason:
            modelError?.error?.code || modelError?.error?.message || "error",
        });
        modelToUse = "gpt-4o-mini";
        completion = await openai.chat.completions.create({
          model: modelToUse,
          temperature: 0.7,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
      } else {
        log("openai_fail", modelError?.message);
        return err(
          502,
          "OPENAI_FAIL",
          "Upstream reflection generation failed.",
          {
            upstream: String(modelError?.message ?? modelError),
          }
        );
      }
    }

    const content = completion.choices?.[0]?.message?.content?.trim() || "{}";
    let reflection = JSON.parse(content);

    // Validate and repair response structure
    const JourneySchema = z.object({
      insights: z.array(z.string()),
      strengths: z.array(z.string()),
      challenges: z.array(z.string()),
      recommendations: z.array(z.string()),
      reflection: z.string().optional(),
    });

    // Check if arrays are empty or missing (need repair)
    const needsRepair =
      !reflection.insights ||
      reflection.insights.length === 0 ||
      !reflection.strengths ||
      reflection.strengths.length === 0 ||
      !reflection.challenges ||
      reflection.challenges.length === 0 ||
      !reflection.recommendations ||
      reflection.recommendations.length === 0;

    let didRepair = false;

    if (needsRepair && reflection.reflection) {
      log("repair_needed", {
        hasNarrative: !!reflection.reflection,
        insights: reflection.insights?.length ?? 0,
        strengths: reflection.strengths?.length ?? 0,
      });

      // Repair prompt: extract structured arrays from narrative
      const repairPrompt = `The following is a reflection narrative about a translation journey. Please extract and return a JSON object with exactly these fields (each must be a non-empty array with 3-6 items):

{
  "insights": ["insight 1", "insight 2", ...],
  "strengths": ["strength 1", "strength 2", ...],
  "challenges": ["challenge 1", "challenge 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...]
}

Reflection narrative:
${reflection.reflection}

Return only valid JSON with all 4 arrays populated.`;

      try {
        const repairCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini", // Use cheaper model for repair
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You extract structured insights from reflection narratives. Return only valid JSON.",
            },
            { role: "user", content: repairPrompt },
          ],
        });

        const repairContent =
          repairCompletion.choices?.[0]?.message?.content?.trim() || "{}";
        const repaired = JSON.parse(repairContent);

        // Merge repaired arrays with original (preserve narrative if present)
        reflection = {
          ...reflection,
          insights: repaired.insights || reflection.insights || [],
          strengths: repaired.strengths || reflection.strengths || [],
          challenges:
            repaired.challenges || reflection.challenges || [],
          recommendations:
            repaired.recommendations || reflection.recommendations || [],
        };

        didRepair = true;
        log("repair_completed", {
          insights: reflection.insights?.length ?? 0,
          strengths: reflection.strengths?.length ?? 0,
        });
      } catch (repairError: any) {
        log("repair_failed", repairError?.message);
        // Fall through with original reflection
      }
    }

    // Add defaults if still missing (final safety net)
    reflection.insights = reflection.insights || [];
    reflection.strengths = reflection.strengths || [];
    reflection.challenges = reflection.challenges || [];
    reflection.recommendations = reflection.recommendations || [];

    // Calculate duration and persist reflection
    const ms = Date.now() - started;
    
    // Insert audit and get ID for persistence
    const promptAuditId = await insertPromptAudit({
      createdBy: user.id,
      projectId: thread.project_id ?? null,
      threadId: body.threadId,
      stage: "journey-reflection",
      provider: "openai",
      model: modelToUse,
      params: {
        duration_ms: ms,
        temperature: modelToUse.startsWith("gpt-5") ? null : 0.7,
      },
      promptSystemMasked: maskPrompts(systemPrompt, userPrompt).promptSystemMasked,
      promptUserMasked: maskPrompts(systemPrompt, userPrompt).promptUserMasked,
      responseExcerpt: content.slice(0, 400),
    }).catch(() => {
      // Swallow audit errors, return null
      return null;
    });

    // Persist reflection to journey_ai_summaries
    try {
      const { error: persistError } = await supabase
        .from("journey_ai_summaries")
        .insert({
          project_id: thread.project_id,
          thread_id: body.threadId,
          created_by: user.id,
          model: modelToUse,
          reflection_text: reflection.reflection ?? null,
          insights: reflection.insights ?? [],
          strengths: reflection.strengths ?? [],
          challenges: reflection.challenges ?? [],
          recommendations: reflection.recommendations ?? [],
          meta: {
            duration_ms: ms,
            repaired: didRepair,
          },
          prompt_audit_id: promptAuditId ?? null,
        });

      if (persistError) {
        log("persist_reflection_failed", persistError.message);
      }
    } catch (err: unknown) {
      // Log but don't fail the request
      log("persist_reflection_failed", err instanceof Error ? err.message : String(err));
    }

    log("success", { ms });
    return ok({ reflection, modelUsed: modelToUse });
  } catch (e: any) {
    console.error("[/api/journey/generate-reflection] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
