import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import OpenAI from "openai";
// import { Redis } from "@upstash/redis"; // Optional dependency
import { TRANSLATOR_MODEL } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  lineIndex: z.number().int().min(0),
  sourceText: z.string().min(1, "sourceText is required"),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as any, { status });
}

function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * POST /api/notebook/prismatic
 * Generate A/B/C translation variants for a specific line
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...a: any[]) =>
    console.log("[/api/notebook/prismatic]", requestId, ...a);

  try {
    // 1) Parse body
    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await req.json());
      log("body ok", { threadId: body.threadId, lineIndex: body.lineIndex });
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
      return err(401, "UNAUTHENTICATED", "Please sign in.");
    }

    // 3) Check cache first (optional - requires @upstash/redis)
    let redis: any = null;
    const cacheKey = `prismatic:${body.threadId}:${body.lineIndex}`;

    // Skip caching for now (requires Redis dependency)
    // TODO: Add Redis caching back when @upstash/redis is installed

    // 4) Fetch thread and context
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

    // 5) Extract guide answers and current translation for context
    const state = (thread.state as any) || {};
    const guideAnswers = state.guide_answers || {};
    const notebookCells = state.notebook_cells || {};
    const currentCell = notebookCells[body.lineIndex] || {};
    const currentTranslation = currentCell.translation?.text || "";

    // 6) Build context prompt
    const contextParts: string[] = [];

    // NEW: Support both translationZone and translationIntent
    // translationZone = broader context/zone for translation
    // translationIntent = specific translation strategy/approach
    const translationZone = (guideAnswers as any)?.translationZone?.trim();
    const translationIntent = guideAnswers.translationIntent?.trim();

    if (translationZone) {
      contextParts.push(`Translation Zone: ${translationZone}`);
    }
    if (translationIntent) {
      contextParts.push(`Translation Strategy: ${translationIntent}`);
    }

    if (guideAnswers.targetLanguage) {
      contextParts.push(
        `Target: ${guideAnswers.targetLanguage.lang} (${
          guideAnswers.targetLanguage.variety || "standard"
        })`
      );
    }
    if (guideAnswers.audience) {
      contextParts.push(`Audience: ${guideAnswers.audience.audience}`);
    }
    if (guideAnswers.stance) {
      contextParts.push(`Stance: ${guideAnswers.stance.closeness}`);
    }
    if (guideAnswers.style?.vibes) {
      contextParts.push(`Style: ${guideAnswers.style.vibes.join(", ")}`);
    }

    const context =
      contextParts.length > 0
        ? contextParts.join("\n")
        : "No specific preferences provided.";

    // 7) Call OpenAI for prismatic variants
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      log("openai_key_missing");
      return err(500, "OPENAI_KEY_MISSING", "Server missing OpenAI API key.");
    }
    const openai = new OpenAI({ apiKey: key });

    const system = [
      "You are a translation variant generator.",
      "Generate 3 distinct translation variants (A, B, C) for a single line of poetry.",
      "Variant A: More literal/close to source",
      "Variant B: Balanced (similar to current translation if provided)",
      "Variant C: More creative/natural",
      "Return STRICT JSON only:",
      '{ "variants": [{ "label": "A"|"B"|"C", "text": string, "rationale": string, "confidence": 0-1 }] }',
    ].join(" ");

    const userPrompt = [
      "Generate 3 translation variants (A, B, C) for this line.",
      "",
      "--- SOURCE LINE ---",
      body.sourceText,
      "",
      "--- TRANSLATOR PREFERENCES ---",
      context,
      "",
      currentTranslation
        ? `--- CURRENT TRANSLATION ---\n${currentTranslation}\n`
        : "",
      "Return valid JSON per schema. Each variant should be distinct in approach.",
    ].join("\n");

    let modelToUse = TRANSLATOR_MODEL;
    let completion;

    // GPT-5 models don't support temperature, top_p, frequency_penalty, etc.
    const isGpt5 = modelToUse.startsWith("gpt-5");

    try {
      log("openai_attempt", { model: modelToUse, isGpt5 });

      if (isGpt5) {
        // GPT-5: No temperature or other sampling parameters
        completion = await openai.chat.completions.create({
          model: modelToUse,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
        });
      } else {
        // GPT-4: Include temperature
        completion = await openai.chat.completions.create({
          model: modelToUse,
          temperature: 0.7,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
        });
      }
    } catch (modelError: any) {
      // If model not found or unsupported, fallback to gpt-4o-mini
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
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
        });
      } else {
        log("openai_fail", modelError?.message);
        return err(
          502,
          "OPENAI_FAIL",
          "Upstream prismatic generation failed.",
          {
            upstream: String(modelError?.message ?? modelError),
          }
        );
      }
    }

    const content = completion.choices?.[0]?.message?.content?.trim() || "{}";
    const parsed = JSON.parse(content);
    const variants = parsed.variants || [];

    // Validate structure
    if (!Array.isArray(variants) || variants.length !== 3) {
      log("invalid_variant_count", { count: variants.length });
      return err(502, "INVALID_RESPONSE", "Expected 3 variants from model");
    }

    // 8) Return result (caching disabled for now)
    const response = { variants };

    log("success", { ms: Date.now() - started });
    return ok(response);
  } catch (e: any) {
    console.error("[/api/notebook/prismatic] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
