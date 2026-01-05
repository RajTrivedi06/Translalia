import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import OpenAI from "openai";
import { TRANSLATOR_MODEL } from "@/lib/models";
import {
  getOrCreateVariantRecipes,
  type ViewpointRangeMode,
  type VariantRecipesBundle,
} from "@/lib/ai/variantRecipes";
import { buildRecipeAwarePrismaticPrompt } from "@/lib/ai/workshopPrompts";
import { buildTranslatorPersonality } from "@/lib/ai/translatorPersonality";
import {
  checkDistinctness,
  regenerateVariant,
  type TranslationVariant,
} from "@/lib/ai/diversityGate";
import type { GuideAnswers } from "@/store/guideSlice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  lineIndex: z.number().int().min(0),
  sourceText: z.string().min(1, "sourceText is required"),
  /** Optional: override poem context (source language, target language, full poem) */
  poemContext: z
    .object({
      fullPoem: z.string().optional(),
      sourceLanguage: z.string().optional(),
      targetLanguage: z.string().optional(),
    })
    .optional(),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as unknown, { status });
}

function err(status: number, code: string, message: string, extra?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(extra as object) } },
    { status }
  );
}

/**
 * POST /api/notebook/prismatic
 * Generate A/B/C translation variants for a specific line using recipe-based generation
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...a: unknown[]) =>
    console.log("[/api/notebook/prismatic]", requestId, ...a);

  try {
    // 1) Parse body
    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await req.json());
      log("body ok", { threadId: body.threadId, lineIndex: body.lineIndex });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log("bad body", message);
      return err(400, "BAD_BODY", "Invalid request body", {
        details: message,
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

    // 3) Fetch thread and context
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

    // 4) Extract state and guide answers
    const state = (thread.state as Record<string, unknown>) || {};
    const guideAnswers = (state.guide_answers || {}) as GuideAnswers;
    const notebookCells = (state.notebook_cells || {}) as Record<
      number,
      { translation?: { text?: string } }
    >;
    const currentCell = notebookCells[body.lineIndex] || {};
    const currentTranslation = currentCell.translation?.text || "";

    // Extract raw poem from state for recipe generation
    const rawPoem =
      (state.raw_poem as string) ||
      body.poemContext?.fullPoem ||
      body.sourceText;

    // Determine source and target languages
    const sourceLanguage =
      body.poemContext?.sourceLanguage ||
      guideAnswers.sourceLanguageVariety ||
      "Unknown";
    const targetLanguage =
      body.poemContext?.targetLanguage ||
      guideAnswers.targetLanguage?.lang ||
      "English";

    // 5) Determine viewpoint range mode
    const mode: ViewpointRangeMode =
      guideAnswers.viewpointRangeMode ?? "balanced";
    log("mode", { mode });

    // 6) Get or create variant recipes (cached per thread + context)
    let recipes: VariantRecipesBundle;
    try {
      recipes = await getOrCreateVariantRecipes(
        body.threadId,
        guideAnswers,
        {
          fullPoem: rawPoem,
          sourceLanguage,
          targetLanguage,
        },
        mode
      );
      log("recipes", {
        cached: recipes.createdAt < Date.now() - 1000,
        mode: recipes.mode,
      });
    } catch (recipeError: unknown) {
      const message =
        recipeError instanceof Error
          ? recipeError.message
          : String(recipeError);

      // If recipe generation contention, return retryable error
      if (message.includes("RECIPE_GENERATION_CONTENTION")) {
        log("recipe_contention", message);
        return err(
          503,
          "RETRY_LATER",
          "Recipe generation in progress. Please retry.",
          {
            retryable: true,
          }
        );
      }

      log("recipe_error", message);
      return err(
        502,
        "RECIPE_GENERATION_FAILED",
        "Failed to generate recipes",
        {
          details: message,
        }
      );
    }

    // 7) Build translator personality
    const personality = buildTranslatorPersonality(guideAnswers);

    // 8) Build context string (for additional context in prompt)
    const contextParts: string[] = [];

    const translationZone = guideAnswers.translationZone?.trim();
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
      contextParts.length > 0 ? contextParts.join("\n") : undefined;

    // 9) Build recipe-aware prompt
    const prompts = buildRecipeAwarePrismaticPrompt({
      sourceText: body.sourceText,
      recipes,
      personality,
      currentTranslation: currentTranslation || undefined,
      context,
    });
    if (process.env.DEBUG_VARIANTS === "1") {
      log("[DEBUG_VARIANTS][prismatic.prompt]", {
        mode,
        model: TRANSLATOR_MODEL,
        system: prompts.system,
        user: prompts.user,
        recipes: recipes.recipes.map((r) => ({
          label: r.label,
          directive: r.directive,
          lens: r.lens,
          unusualnessBudget: r.unusualnessBudget,
        })),
      });
    }

    // 10) Call OpenAI for prismatic variants (single call on happy path)
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      log("openai_key_missing");
      return err(500, "OPENAI_KEY_MISSING", "Server missing OpenAI API key.");
    }
    const openai = new OpenAI({ apiKey: key });

    let modelToUse = TRANSLATOR_MODEL;
    let completion;

    // GPT-5 models don't support temperature, top_p, frequency_penalty, etc.
    const isGpt5 = modelToUse.startsWith("gpt-5");
    const temperature =
      mode === "focused" ? 0.4 : mode === "adventurous" ? 0.95 : 0.7;
    const presence_penalty = mode === "adventurous" ? 0.6 : 0;

    try {
      log("openai_attempt", {
        model: modelToUse,
        isGpt5,
        mode,
        temperature: isGpt5 ? null : temperature,
        presence_penalty: isGpt5 ? null : presence_penalty,
      });

      if (isGpt5) {
        // GPT-5: No temperature or other sampling parameters
        completion = await openai.chat.completions.create({
          model: modelToUse,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: prompts.system },
            { role: "user", content: prompts.user },
          ],
        });
      } else {
        // GPT-4: Include temperature
        completion = await openai.chat.completions.create({
          model: modelToUse,
          temperature,
          presence_penalty,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: prompts.system },
            { role: "user", content: prompts.user },
          ],
        });
      }
    } catch (modelError: unknown) {
      const modelErr = modelError as {
        error?: { code?: string; message?: string };
        status?: number;
        message?: string;
      };

      // If model not found or unsupported, fallback to gpt-4o-mini
      const shouldFallback =
        modelErr?.error?.code === "model_not_found" ||
        modelErr?.status === 404 ||
        modelErr?.status === 400;

      if (shouldFallback) {
        log("fallback_to_gpt4", {
          from: modelToUse,
          to: "gpt-4o-mini",
          reason: modelErr?.error?.code || modelErr?.error?.message || "error",
        });
        modelToUse = "gpt-4o-mini";
        completion = await openai.chat.completions.create({
          model: modelToUse,
          temperature,
          presence_penalty,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: prompts.system },
            { role: "user", content: prompts.user },
          ],
        });
      } else {
        log("openai_fail", modelErr?.message);
        return err(
          502,
          "OPENAI_FAIL",
          "Upstream prismatic generation failed.",
          {
            upstream: String(modelErr?.message ?? modelError),
          }
        );
      }
    }

    const content = completion.choices?.[0]?.message?.content?.trim() || "{}";
    const parsed = JSON.parse(content);
    let variants: TranslationVariant[] = parsed.variants || [];

    // Validate structure
    if (!Array.isArray(variants) || variants.length !== 3) {
      log("invalid_variant_count", { count: variants.length });
      return err(502, "INVALID_RESPONSE", "Expected 3 variants from model");
    }

    // 11) Distinctness gate (cheap checks with mode-scaling)
    const gateResult = checkDistinctness(variants, {
      targetLanguage,
      mode,
      sourceText: body.sourceText,
    });
    log("distinctness_gate", {
      pass: gateResult.pass,
      maxOverlap: gateResult.details?.maxOverlap,
    });
    if (process.env.DEBUG_VARIANTS === "1") {
      log("[DEBUG_VARIANTS][gate.result]", {
        pass: gateResult.pass,
        worstIndex: gateResult.worstIndex,
        reason: gateResult.reason,
        details: gateResult.details,
      });
    }

    // 12) Conditional single-variant regeneration (max 1 extra call)
    if (!gateResult.pass && gateResult.worstIndex !== null) {
      log("regenerating_variant", {
        index: gateResult.worstIndex,
        reason: gateResult.reason,
      });
      if (process.env.DEBUG_VARIANTS === "1") {
        log("[DEBUG_VARIANTS][regen.invoked]", {
          index: gateResult.worstIndex,
          reason: gateResult.reason,
          recipe: recipes.recipes[gateResult.worstIndex],
        });
      }

      try {
        const regenerated = await regenerateVariant(
          variants,
          gateResult.worstIndex,
          recipes.recipes[gateResult.worstIndex],
          {
            sourceText: body.sourceText,
            sourceLanguage,
            targetLanguage,
          }
        );
        variants[gateResult.worstIndex] = regenerated;
        log("regeneration_complete");
      } catch (regenError: unknown) {
        // Regeneration failed - continue with original variants
        const message =
          regenError instanceof Error ? regenError.message : String(regenError);
        log("regeneration_failed", message);
        // Don't fail the whole request, just use original variants
      }
    }

    // 13) Return result
    const response = {
      variants,
      meta: {
        mode: recipes.mode,
        recipesGenerated: Date.now() - recipes.createdAt < 5000, // true if just generated
        distinctnessPass: gateResult.pass,
      },
    };

    log("success", { ms: Date.now() - started });
    return ok(response);
  } catch (e: unknown) {
    console.error("[/api/notebook/prismatic] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
