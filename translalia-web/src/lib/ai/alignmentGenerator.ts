// src/lib/ai/alignmentGenerator.ts
import { z } from "zod";
import { openai } from "@/lib/ai/openai";
import { trackCallStart, trackCallEnd } from "@/lib/ai/openaiInstrumentation";

const AlignedWordSchema = z.object({
  original: z.string(),
  translation: z.string(),
  partOfSpeech: z.string(),
  position: z.number().int().min(0),
});

const AlignmentResponseSchema = z.object({
  words: z.array(AlignedWordSchema),
});

const BatchedAlignmentResponseSchema = z.object({
  variants: z.array(
    z.object({
      variant: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      words: z.array(AlignedWordSchema),
    })
  ),
});

export type AlignedWord = z.infer<typeof AlignedWordSchema>;

/**
 * Generates word-level alignment for a translation variant.
 * Used to make P6-P8 (Prismatic) variants compatible with Workshop's drag-and-drop UX.
 *
 * @param sourceText - Original text in source language
 * @param translatedText - Translated text in target language
 * @param sourceLanguage - Source language name
 * @param targetLanguage - Target language name
 * @returns Array of aligned words with part-of-speech tags
 */
export async function generateAlignmentForVariant(
  sourceText: string,
  translatedText: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<AlignedWord[]> {
  const systemPrompt = `You are a linguistic alignment tool that creates word-by-word mappings between source and translated text.

Your task is to align each word in the source text with corresponding word(s) in the translation, maintaining semantic relationships.

Rules:
1. Each source word should map to one or more translation words
2. Preserve word order based on source text position
3. Tag part of speech: noun, verb, adjective, adverb, preposition, conjunction, pronoun, article, or neutral
4. Handle multi-word phrases by creating separate entries with same position
5. For grammatical particles or function words, use "neutral" as part of speech
6. Position index starts at 0 and increments for each source word

Return ONLY valid JSON matching this schema:
{
  "words": [
    {
      "original": "source_word",
      "translation": "translated_word",
      "partOfSpeech": "noun|verb|adjective|etc",
      "position": 0
    }
  ]
}`;

  const userPrompt = `Create word-by-word alignment for this translation:

Source (${sourceLanguage}): "${sourceText}"
Translation (${targetLanguage}): "${translatedText}"

Analyze the semantic structure and create precise alignments. Return JSON only.`;

  const requestId = trackCallStart("align");
  const alignStart = Date.now();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0, // Deterministic for consistency
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    trackCallEnd(requestId, {
      status: "ok",
      latencyMs: Date.now() - alignStart,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
      model: "gpt-4o-mini",
      temperature: 0,
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    const validation = AlignmentResponseSchema.safeParse(parsed);

    if (!validation.success) {
      console.error(
        "[alignmentGenerator] Validation error:",
        validation.error.issues
      );

      // Fallback: create simple word-to-word mapping
      const sourceWords = sourceText.trim().split(/\s+/);
      const translationWords = translatedText.trim().split(/\s+/);

      return sourceWords.map((word, idx) => ({
        original: word,
        translation: translationWords[idx] ?? word,
        partOfSpeech: "neutral",
        position: idx,
      }));
    }

    return validation.data.words;
  } catch (error: unknown) {
    const errorObj = error as {
      name?: string;
      status?: number;
      message?: string;
    };
    trackCallEnd(requestId, {
      status: "error",
      latencyMs: Date.now() - alignStart,
      errorName: errorObj.name,
      httpStatus: errorObj.status,
      errorMessageShort: errorObj.message?.slice(0, 100),
      model: "gpt-4o-mini",
      temperature: 0,
    });
    console.error("[alignmentGenerator] Error:", error);

    // Fallback: create simple word-to-word mapping
    const sourceWords = sourceText.trim().split(/\s+/);
    const translationWords = translatedText.trim().split(/\s+/);

    return sourceWords.map((word, idx) => ({
      original: word,
      translation: translationWords[idx] ?? word,
      partOfSpeech: "neutral",
      position: idx,
    }));
  }
}

/**
 * Generates alignments for multiple variants in a single batched call.
 * Optimized to reduce API calls from 3 to 1 per line.
 *
 * @param sourceText - Original text in source language
 * @param variants - Array of translated texts (typically 3 variants)
 * @param sourceLanguage - Source language name
 * @param targetLanguage - Target language name
 * @returns Array of alignment arrays (one per variant)
 */
export async function generateAlignmentsBatched(
  sourceText: string,
  variants: string[],
  sourceLanguage: string,
  targetLanguage: string
): Promise<AlignedWord[][]> {
  if (variants.length === 0) {
    return [];
  }

  const systemPrompt = `You are a linguistic alignment tool that creates word-by-word mappings between source and translated text.

Your task is to align each word in the source text with corresponding word(s) in each translation variant, maintaining semantic relationships.

Rules:
1. Each source word should map to one or more translation words
2. Preserve word order based on source text position
3. Tag part of speech: noun, verb, adjective, adverb, preposition, conjunction, pronoun, article, or neutral
4. Handle multi-word phrases by creating separate entries with same position
5. For grammatical particles or function words, use "neutral" as part of speech
6. Position index starts at 0 and increments for each source word

Return ONLY valid JSON matching this schema:
{
  "variants": [
    {
      "variant": 1,
      "words": [
        {
          "original": "source_word",
          "translation": "translated_word",
          "partOfSpeech": "noun|verb|adjective|etc",
          "position": 0
        }
      ]
    },
    {
      "variant": 2,
      "words": [...]
    },
    {
      "variant": 3,
      "words": [...]
    }
  ]
}`;

  const variantsList = variants
    .map((text, idx) => `Variant ${idx + 1}: "${text}"`)
    .join("\n");

  const userPrompt = `Create word-by-word alignments for all translation variants:

Source (${sourceLanguage}): "${sourceText}"

Translations (${targetLanguage}):
${variantsList}

Analyze the semantic structure and create precise alignments for each variant. Return JSON only.`;

  const requestId = trackCallStart("align");
  const alignStart = Date.now();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0, // Deterministic for consistency
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    trackCallEnd(requestId, {
      status: "ok",
      latencyMs: Date.now() - alignStart,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
      model: "gpt-4o-mini",
      temperature: 0,
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    const validation = BatchedAlignmentResponseSchema.safeParse(parsed);

    if (!validation.success) {
      console.error(
        "[alignmentGenerator] Batched validation error:",
        validation.error.issues
      );

      // Fallback: use parallel individual calls
      console.log(
        "[alignmentGenerator] Falling back to parallel individual calls"
      );
      return generateAlignmentsParallel(
        sourceText,
        variants,
        sourceLanguage,
        targetLanguage
      );
    }

    // Map variant numbers to arrays, ensuring order matches input
    const alignments: AlignedWord[][] = [];
    for (let i = 0; i < variants.length; i++) {
      const variantData = validation.data.variants.find(
        (v) => v.variant === i + 1
      );
      alignments.push(variantData?.words || []);
    }

    return alignments;
  } catch (error: unknown) {
    const errorObj = error as {
      name?: string;
      status?: number;
      message?: string;
    };
    trackCallEnd(requestId, {
      status: "error",
      latencyMs: Date.now() - alignStart,
      errorName: errorObj.name,
      httpStatus: errorObj.status,
      errorMessageShort: errorObj.message?.slice(0, 100),
      model: "gpt-4o-mini",
      temperature: 0,
    });
    console.error("[alignmentGenerator] Batched alignment error:", error);

    // Fallback: use parallel individual calls
    console.log(
      "[alignmentGenerator] Falling back to parallel individual calls after error"
    );
    return generateAlignmentsParallel(
      sourceText,
      variants,
      sourceLanguage,
      targetLanguage
    );
  }
}

/**
 * Generates alignments for multiple variants in parallel (legacy, used as fallback).
 * @deprecated Use generateAlignmentsBatched for better performance
 */
export async function generateAlignmentsParallel(
  sourceText: string,
  variants: string[],
  sourceLanguage: string,
  targetLanguage: string
): Promise<AlignedWord[][]> {
  const alignmentPromises = variants.map((translatedText) =>
    generateAlignmentForVariant(
      sourceText,
      translatedText,
      sourceLanguage,
      targetLanguage
    )
  );

  return Promise.all(alignmentPromises);
}
