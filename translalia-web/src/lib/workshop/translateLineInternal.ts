import { z } from "zod";

import { openai } from "@/lib/ai/openai";
import { cacheGet, cacheSet } from "@/lib/ai/cache";
import {
  buildLineTranslationPrompt,
  buildLineTranslationFallbackPrompt,
  buildLineTranslationFallbackSystemPrompt,
} from "@/lib/ai/workshopPrompts";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { maskPrompts } from "@/server/audit/mask";
import { insertPromptAudit } from "@/server/audit/insertPromptAudit";
import type { GuideAnswers } from "@/store/guideSlice";
import type { LineTranslationResponse } from "@/types/lineTranslation";

function getOpenAIModelErrorDetails(error: unknown): {
  code?: string;
  message?: string;
  status?: number;
} {
  if (!error || typeof error !== "object") {
    return {};
  }

  const candidate = error as Record<string, unknown>;
  const nestedError =
    candidate.error && typeof candidate.error === "object"
      ? (candidate.error as { code?: string; message?: string })
      : undefined;

  return {
    code: nestedError?.code,
    message: nestedError?.message,
    status:
      typeof candidate.status === "number"
        ? (candidate.status as number)
        : undefined,
  };
}

function computeLinePosition(
  fullPoem: string,
  lineIndex: number
): { isFirst: boolean; isLast: boolean; isOnly: boolean } {
  const lines = String(fullPoem ?? "").split("\n");
  const nonEmptyIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if ((lines[i] ?? "").trim() !== "") nonEmptyIndices.push(i);
  }

  // If fullPoem doesn't include blank lines (or lineIndex is in a flattened index space),
  // fall back to treating 0..N-1 as the range.
  if (nonEmptyIndices.length === 0 || lineIndex >= lines.length) {
    const n = lines.filter((l) => String(l).length > 0).length || lines.length;
    return {
      isOnly: n === 1,
      isFirst: lineIndex === 0,
      isLast: lineIndex === Math.max(0, n - 1),
    };
  }

  const first = nonEmptyIndices[0];
  const last = nonEmptyIndices[nonEmptyIndices.length - 1];
  return {
    isOnly: nonEmptyIndices.length === 1,
    isFirst: lineIndex === first,
    isLast: lineIndex === last,
  };
}

const AlignedWordSchema = z.object({
  original: z.string(),
  translation: z.string(),
  partOfSpeech: z.string(),
  position: z.number().int().min(0),
});

const MetadataSchema = z.object({
  literalness: z.number().min(0).max(1),
  characterCount: z.number().int().min(0),
  preservesRhyme: z.boolean().optional(),
  preservesMeter: z.boolean().optional(),
});

const VariantSchema = z.object({
  variant: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  fullText: z.string(),
  words: z.array(AlignedWordSchema),
  metadata: MetadataSchema,
});

const LineTranslationResponseSchema = z.object({
  lineOriginal: z.string(),
  translations: z.tuple([VariantSchema, VariantSchema, VariantSchema]),
  modelUsed: z.string(),
});

export type TranslateLineInternalOptions = {
  threadId: string;
  lineIndex: number;
  lineText: string;
  fullPoem: string;
  stanzaIndex?: number;
  prevLine?: string;
  nextLine?: string;
  guideAnswers: GuideAnswers;
  sourceLanguage: string;
  targetLanguage: string;
  cacheKey?: string;
  forceRefresh?: boolean;
  audit?: {
    createdBy: string;
    projectId: string | null;
    stage?: string;
  };
  modelOverride?: string;
  /** Feature 9 (R): Use simplified translation without alignment */
  fallbackMode?: boolean;
};

export async function translateLineInternal(
  options: TranslateLineInternalOptions
): Promise<LineTranslationResponse> {
  const {
    threadId,
    lineIndex,
    lineText,
    fullPoem,
    prevLine,
    nextLine,
    stanzaIndex,
    guideAnswers,
    sourceLanguage,
    targetLanguage,
    cacheKey,
    forceRefresh = false,
    audit,
    modelOverride,
    fallbackMode = false,
  } = options;

  // Include model in cache key so switching models doesn't accidentally reuse a
  // prior translation (and so the model badge matches what actually ran).
  const requestedModel = modelOverride ?? TRANSLATOR_MODEL;
  const effectiveCacheKey =
    cacheKey ??
    `workshop:translate-line:${threadId}:line:${lineIndex}:model:${requestedModel}`;

  if (!forceRefresh) {
    const cached = await cacheGet<LineTranslationResponse>(effectiveCacheKey);
    if (cached) {
      return cached;
    }
  }

  // Feature 9 (R): Use fallback prompt if alignment failed
  const position = computeLinePosition(fullPoem, lineIndex);

  const prompt = fallbackMode
    ? null
    : buildLineTranslationPrompt({
        lineText,
        lineIndex,
        prevLine: prevLine ?? null,
        nextLine: nextLine ?? null,
        fullPoem,
        stanzaIndex,
        position,
        guideAnswers,
        sourceLanguage,
        targetLanguage,
      });

  const systemPrompt = fallbackMode
    ? buildLineTranslationFallbackSystemPrompt()
    : prompt!.system;

  const userPrompt = fallbackMode
    ? buildLineTranslationFallbackPrompt({
        lineText,
        lineIndex,
        fullPoem,
        stanzaIndex,
        guideAnswers,
        sourceLanguage,
      })
    : prompt!.user;

  if (process.env.NODE_ENV !== "production" && !fallbackMode) {
    console.log(
      "[translateLineInternal] User prompt (preview):",
      userPrompt.slice(0, 500)
    );
  }

  const auditMask = maskPrompts(systemPrompt, userPrompt);

  let model = modelOverride ?? TRANSLATOR_MODEL;
  let completion;

  const isGpt5 = model.startsWith("gpt-5");

  try {
    if (isGpt5) {
      completion = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    } else {
      completion = await openai.chat.completions.create({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    }
  } catch (modelError: unknown) {
    const { code, message, status } = getOpenAIModelErrorDetails(modelError);

    const shouldFallback =
      code === "model_not_found" || status === 404 || status === 400;

    if (!shouldFallback) {
      throw modelError;
    }

    console.warn(
      `[translateLineInternal] Model ${model} fallback to gpt-4o-mini:`,
      code || message || "error"
    );
    model = "gpt-4o-mini";
    completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
  }

  const text = completion.choices[0]?.message?.content ?? "{}";

  if (audit?.createdBy) {
    insertPromptAudit({
      createdBy: audit.createdBy,
      projectId: audit.projectId ?? null,
      threadId,
      stage: audit.stage ?? "workshop-translate-line",
      provider: "openai",
      model,
      params: {
        lineIndex,
        lineLength: lineText.length,
      },
      promptSystemMasked: auditMask.promptSystemMasked,
      promptUserMasked: auditMask.promptUserMasked,
      responseExcerpt: text.slice(0, 400),
    }).catch(() => undefined);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (parseError) {
    console.error("[translateLineInternal] Parse error:", parseError);
    throw new Error("Failed to parse AI response");
  }

  const responseValidation = LineTranslationResponseSchema.safeParse({
    lineOriginal: lineText,
    translations: (parsed as { translations?: unknown[] })?.translations || [],
    modelUsed: model,
  });

  if (!responseValidation.success) {
    console.error(
      "[translateLineInternal] Validation error:",
      responseValidation.error.issues
    );

    const translations = (parsed as { translations?: unknown[] })?.translations;

    if (!Array.isArray(translations) || translations.length < 3) {
      // Feature 9 (R): If alignment validation fails and not in fallback mode, try fallback
      if (!fallbackMode) {
        console.warn(
          `[translateLineInternal] Alignment failed for line ${lineIndex}, attempting fallback mode`
        );
        return translateLineInternal({
          ...options,
          fallbackMode: true,
          forceRefresh: true,
        });
      }

      throw new Error("AI returned invalid structure (expected 3 variants)");
    }

    const fixedTranslations = translations.slice(0, 3).map((t, idx) => {
      const variant = t as {
        variant?: number;
        fullText?: string;
        words?: unknown[];
        metadata?: unknown;
      };
      return {
        variant: (variant.variant ?? idx + 1) as 1 | 2 | 3,
        fullText: variant.fullText || lineText,
        words: Array.isArray(variant.words)
          ? variant.words.map((w, pos) => {
              const word = w as {
                original?: string;
                translation?: string;
                partOfSpeech?: string;
                position?: number;
              };
              return {
                original: word.original || "",
                translation: word.translation || "",
                partOfSpeech: word.partOfSpeech || "neutral",
                position: word.position ?? pos,
              };
            })
          : [],
        metadata: {
          literalness:
            (variant.metadata as { literalness?: number })?.literalness ?? 0.5,
          characterCount:
            (variant.metadata as { characterCount?: number })?.characterCount ??
            variant.fullText?.length ??
            0,
          preservesRhyme:
            (variant.metadata as { preservesRhyme?: boolean })
              ?.preservesRhyme ?? false,
          preservesMeter:
            (variant.metadata as { preservesMeter?: boolean })
              ?.preservesMeter ?? false,
        },
      };
    }) as [
      LineTranslationResponse["translations"][0],
      LineTranslationResponse["translations"][1],
      LineTranslationResponse["translations"][2]
    ];

    const fallbackResponse: LineTranslationResponse = {
      lineOriginal: lineText,
      translations: fixedTranslations,
      modelUsed: model,
    };

    await cacheSet(effectiveCacheKey, fallbackResponse, 3600);
    return fallbackResponse;
  }

  const result = responseValidation.data;
  await cacheSet(effectiveCacheKey, result, 3600);
  return result;
}
