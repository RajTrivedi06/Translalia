import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import OpenAI from "openai";
import { createServerClient } from "@supabase/ssr";
import { ENHANCER_MODEL } from "@/lib/models";

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

    // 3) Thread ownership
    const { data: thread, error: threadErr } = await supabase
      .from("chat_threads")
      .select("id,created_by")
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

    const systemPrompt = `You are a poetry translation coach providing reflective insights on a translator's journey.

IMPORTANT: Do NOT compare source and translation quality. Instead, reflect on:
- The translator's creative choices and decision-making process
- Patterns in their approach
- Growth and learning throughout the translation
- Challenges they navigated
- Strengths they demonstrated

Return STRICT JSON only with this schema:
{
  "summary": "1-2 paragraph reflection on their translation journey",
  "insights": ["insight 1", "insight 2", ...],
  "strengths": ["strength 1", "strength 2", ...],
  "challenges": ["challenge 1", "challenge 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "overallAssessment": "encouraging final reflection on their work"
}`;

    const userPrompt = `Translation Journey Context:

Progress: ${context.completedCount}/${context.totalLines} lines (${
      context.progressPercentage
    }%)

Translation Strategy: ${translationStrategy}

Guide Answers: ${JSON.stringify(context.guideAnswers, null, 2)}

Completed Translations:
${completedLinesText || "No lines completed yet"}

Please provide a reflective journey summary focusing on the translator's process, growth, and decisions (NOT a quality comparison of source vs translation).`;

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
    const reflection = JSON.parse(content);

    // Add some defaults if AI didn't provide them
    reflection.insights = reflection.insights || [];
    reflection.strengths = reflection.strengths || [];
    reflection.challenges = reflection.challenges || [];
    reflection.recommendations = reflection.recommendations || [];

    log("success", { ms: Date.now() - started });
    return ok({ reflection, modelUsed: modelToUse });
  } catch (e: any) {
    console.error("[/api/journey/generate-reflection] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
