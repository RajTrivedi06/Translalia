// src/lib/ai/alignmentGenerator.ts
import { z } from "zod";
import { openai } from "@/lib/ai/openai";

const AlignedWordSchema = z.object({
  original: z.string(),
  translation: z.string(),
  partOfSpeech: z.string(),
  position: z.number().int().min(0),
});

const AlignmentResponseSchema = z.object({
  words: z.array(AlignedWordSchema),
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
  } catch (error) {
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
 * Generates alignments for multiple variants in parallel.
 * Optimized for P6-P8 which produces 3 variants simultaneously.
 *
 * @param sourceText - Original text in source language
 * @param variants - Array of translated texts
 * @param sourceLanguage - Source language name
 * @param targetLanguage - Target language name
 * @returns Array of alignment arrays (one per variant)
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
