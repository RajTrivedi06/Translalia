// app/api/workshop/translate-line-with-recipes/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/requireUser";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkDailyLimit } from "@/lib/ratelimit/redis";
import type { GuideAnswers } from "@/store/guideSlice";
import type { LineTranslationResponse } from "@/types/lineTranslation";
import { openai } from "@/lib/ai/openai";
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
import {
  generateAlignmentsParallel,
  type AlignedWord,
} from "@/lib/ai/alignmentGenerator";
import { maskPrompts } from "@/server/audit/mask";
import { insertPromptAudit } from "@/server/audit/insertPromptAudit";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  lineText: z.string().min(1),
  fullPoem: z.string(),
  stanzaIndex: z.number().int().optional(),
  prevLine: z.string().optional(),
  nextLine: z.string().optional(),
});

/**
 * POST /api/workshop/translate-line-with-recipes
 *
 * Method 2: P6-P8 Recipe-Driven Prismatic Variants
 * - Generates variants using sophisticated recipe system with lens configurations
 * - Runs distinctness gate to ensure diversity
 * - Regenerates variants if needed using feature-contrastive constraints
 * - Post-processes to add word-level alignment for Workshop UX compatibility
 * - Returns identical structure to /translate-line for seamless integration
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      threadId,
      lineIndex,
      lineText,
      fullPoem,
      stanzaIndex,
      prevLine,
      nextLine,
    } = validation.data;

    const rateCheck = await checkDailyLimit(
      user.id,
      `workshop:translate-line-recipes:${threadId}`,
      10 * 60
    );

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          current: rateCheck.current,
          max: rateCheck.max,
        },
        { status: 429 }
      );
    }

    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state, project_id")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { error: "Thread not found or unauthorized" },
        { status: 404 }
      );
    }

    const state = (thread.state as Record<string, unknown>) || {};
    const guideAnswers: GuideAnswers =
      (state.guide_answers as GuideAnswers) || {};
    const poemAnalysis = (state.poem_analysis as { language?: string }) || {};
    const rawPoem = (state.raw_poem as string) || fullPoem || "";

    // Handle empty lines
    if (!lineText.trim()) {
      const emptyResponse: LineTranslationResponse = {
        lineOriginal: lineText,
        translations: [
          {
            variant: 1,
            fullText: "",
            words: [],
            metadata: { literalness: 1.0, characterCount: 0 },
          },
          {
            variant: 2,
            fullText: "",
            words: [],
            metadata: { literalness: 1.0, characterCount: 0 },
          },
          {
            variant: 3,
            fullText: "",
            words: [],
            metadata: { literalness: 1.0, characterCount: 0 },
          },
        ],
        modelUsed: TRANSLATOR_MODEL,
      };
      return NextResponse.json(emptyResponse);
    }

    // Determine source and target languages
    const sourceLanguage = poemAnalysis.language || "the source language";
    const targetLang = guideAnswers.targetLanguage?.lang?.trim();
    const targetVariety = guideAnswers.targetLanguage?.variety?.trim();
    const targetLanguage = targetLang
      ? `${targetLang}${targetVariety ? ` (${targetVariety})` : ""}`
      : "the target language";

    // Determine viewpoint range mode
    const mode: ViewpointRangeMode =
      guideAnswers.viewpointRangeMode ?? "balanced";

    // Get or create variant recipes (cached per thread + context)
    let recipes: VariantRecipesBundle;
    try {
      recipes = await getOrCreateVariantRecipes(
        threadId,
        guideAnswers,
        {
          fullPoem: rawPoem,
          sourceLanguage,
          targetLanguage,
        },
        mode
      );
    } catch (recipeError: unknown) {
      const message =
        recipeError instanceof Error
          ? recipeError.message
          : String(recipeError);

      // If recipe generation contention, return retryable error
      if (message.includes("RECIPE_GENERATION_CONTENTION")) {
        return NextResponse.json(
          {
            error: "Recipe generation in progress. Please retry.",
            retryable: true,
          },
          { status: 503 }
        );
      }

      console.error("[translate-line-with-recipes] Recipe error:", message);
      return NextResponse.json(
        { error: "Failed to generate recipes", details: message },
        { status: 502 }
      );
    }

    // Build translator personality
    const personality = buildTranslatorPersonality(guideAnswers);

    // Build context string
    const contextParts: string[] = [];
    const translationZone = guideAnswers.translationZone?.trim();
    const translationIntent = guideAnswers.translationIntent?.trim();

    if (translationZone) {
      contextParts.push(`Translation Zone: ${translationZone}`);
    }
    if (translationIntent) {
      contextParts.push(`Translation Intent: ${translationIntent}`);
    }

    const contextStr = contextParts.length > 0 ? contextParts.join("\n") : "";

    // Build recipe-aware prismatic prompt
    const { system: systemPrompt, user: userPrompt } =
      buildRecipeAwarePrismaticPrompt({
        sourceText: lineText,
        recipes,
        personality,
        context: contextStr,
      });

    const auditMask = maskPrompts(systemPrompt, userPrompt);

    // Generate initial variants
    const model = guideAnswers.translationModel ?? TRANSLATOR_MODEL;
    let completion;

    // GPT-5 models don't support custom temperature - only default (1) is allowed
    const isGpt5 = model.startsWith("gpt-5");

    try {
      completion = isGpt5
        ? await openai.chat.completions.create({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          })
        : await openai.chat.completions.create({
            model,
            temperature: 0.7,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
    } catch (error) {
      console.error("[translate-line-with-recipes] OpenAI error:", error);
      return NextResponse.json(
        { error: "Translation service error" },
        { status: 502 }
      );
    }

    const text = completion.choices[0]?.message?.content ?? "{}";

    // Audit initial generation
    insertPromptAudit({
      createdBy: user.id,
      projectId: thread.project_id ?? null,
      threadId,
      stage: "workshop-translate-line-recipes",
      provider: "openai",
      model,
      params: {
        lineIndex,
        lineLength: lineText.length,
        method: "p6-p8-recipes",
      },
      promptSystemMasked: auditMask.promptSystemMasked,
      promptUserMasked: auditMask.promptUserMasked,
      responseExcerpt: text.slice(0, 400),
    }).catch(() => undefined);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error("[translate-line-with-recipes] Parse error:", parseError);
      return NextResponse.json(
        { error: "Failed to parse translation response" },
        { status: 502 }
      );
    }

    // Extract variants
    const responseObj = parsed as {
      variants?: Array<{ label?: string; translation?: string }>;
    };
    const rawVariants = responseObj.variants || [];

    if (rawVariants.length < 3) {
      console.error(
        "[translate-line-with-recipes] Insufficient variants:",
        rawVariants.length
      );
      return NextResponse.json(
        { error: "Translation service returned incomplete results" },
        { status: 502 }
      );
    }

    // Prepare variants for distinctness check
    const variants: TranslationVariant[] = rawVariants
      .slice(0, 3)
      .map((v, i) => ({
        label: (v.label || ["A", "B", "C"][i]) as "A" | "B" | "C",
        text: v.translation || "",
      }));

    // Run distinctness gate (mode-scaled)
    const gateResult = checkDistinctness(variants, {
      mode,
      targetLanguage,
      sourceText: lineText,
    });

    // Regenerate at most one variant if needed (diversityGate API)
    if (!gateResult.pass && gateResult.worstIndex !== null) {
      const idx = gateResult.worstIndex;
      const label = variants[idx]?.label;
      const recipeForLabel = recipes.recipes.find((r) => r.label === label);

      if (label && recipeForLabel) {
        try {
          const regenerated = await regenerateVariant(
            variants,
            idx,
            recipeForLabel,
            {
              sourceText: lineText,
              sourceLanguage,
              targetLanguage,
              prevLine,
              nextLine,
            }
          );

          variants[idx] = regenerated;
        } catch (regenError) {
          console.error(
            `[translate-line-with-recipes] Regeneration failed for ${label}:`,
            regenError
          );
          // Keep original variant if regeneration fails
        }
      }
    }

    // Generate word-level alignments for all variants (in parallel)
    const variantTexts = variants.map((v) => v.text);
    let alignments: AlignedWord[][];

    try {
      alignments = await generateAlignmentsParallel(
        lineText,
        variantTexts,
        sourceLanguage,
        targetLanguage
      );
    } catch (alignmentError) {
      console.error(
        "[translate-line-with-recipes] Alignment error:",
        alignmentError
      );
      // Fallback: create simple word-to-word mappings
      const sourceWords = lineText.trim().split(/\s+/);
      alignments = variantTexts.map((translatedText) => {
        const translationWords = translatedText.trim().split(/\s+/);
        return sourceWords.map((word, idx) => ({
          original: word,
          translation: translationWords[idx] ?? word,
          partOfSpeech: "neutral",
          position: idx,
        }));
      });
    }

    // Build final response (matching LineTranslationResponse structure)
    const result: LineTranslationResponse = {
      lineOriginal: lineText,
      translations: [
        {
          variant: 1,
          fullText: variants[0]?.text || "",
          words: alignments[0] || [],
          metadata: {
            literalness: 0.8, // Recipe A typically more literal
            characterCount: variants[0]?.text.length || 0,
          },
        },
        {
          variant: 2,
          fullText: variants[1]?.text || "",
          words: alignments[1] || [],
          metadata: {
            literalness: 0.5, // Recipe B typically balanced
            characterCount: variants[1]?.text.length || 0,
          },
        },
        {
          variant: 3,
          fullText: variants[2]?.text || "",
          words: alignments[2] || [],
          metadata: {
            literalness: 0.2, // Recipe C typically more creative
            characterCount: variants[2]?.text.length || 0,
          },
        },
      ],
      modelUsed: model,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[translate-line-with-recipes] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
