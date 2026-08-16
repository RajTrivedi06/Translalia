import { z } from "zod";

export const SuggestionUseSchema = z.enum([
  "replace",
  "insert",
  "opening",
  "closing",
]);

export const FitsWithSchema = z.enum(["A", "B", "C", "any"]);

export const WordSuggestionSchema = z.object({
  word: z.string().min(1),
  use: SuggestionUseSchema.optional().default("insert"),
  fitsWith: FitsWithSchema.optional().default("any"),
  // The word in the current line this suggestion is an alternative for.
  // Used by line-level suggestions to spread ideas across the whole line and
  // group results by the word they replace. Optional: token suggestions omit it.
  targetsWord: z.string().optional().nullable(),
  register: z.string().optional().default("neutral"),
  literalness: z.number().min(0).max(1).optional().default(0.5),
  reasoning: z.string().optional().default(""),
});

export const SuggestionsResponseSchema = z.object({
  suggestions: z.array(WordSuggestionSchema).min(1),
});

export const LineSuggestionsRequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  currentLine: z.string().min(1),
  sourceLine: z.string().min(1).optional(),
  previousLine: z.string().optional().nullable(),
  nextLine: z.string().optional().nullable(),
  fullPoem: z.string().min(1),
  poemTheme: z.string().optional(),
  userGuidance: z.string().optional().nullable(),
  targetLanguage: z.string().min(1),
  targetLineDraft: z.string().optional().nullable(),
  variantFullTexts: z
    .object({
      A: z.string().optional().nullable(),
      B: z.string().optional().nullable(),
      C: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  selectedVariant: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .nullable(),
});

export const TokenSuggestionsRequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  currentLine: z.string().min(1),
  sourceLine: z.string().min(1),
  previousLine: z.string().optional().nullable(),
  nextLine: z.string().optional().nullable(),
  fullPoem: z.string().min(1),
  poemTheme: z.string().optional(),
  userGuidance: z.string().optional().nullable(),
  extraHints: z
    .array(z.string().min(1).max(120))
    .max(5)
    .optional()
    .nullable(),
  suggestionRangeMode: z
    .enum(["focused", "balanced", "adventurous"])
    .optional()
    .nullable(),
  targetLanguage: z.string().min(1),
  targetLineDraft: z.string().optional().nullable(),
  variantFullTexts: z
    .object({
      A: z.string().optional().nullable(),
      B: z.string().optional().nullable(),
      C: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  selectedVariant: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .nullable(),
  focus: z.object({
    word: z.string().min(1),
    originalWord: z.string().optional().nullable(),
    partOfSpeech: z.string().optional().nullable(),
    /**
     * Whitespace-token index of the focused word.
     *
     * Legacy identifier. The server re-resolves it against its OWN
     * `split(/\s+/)` in `markTokenInText`, so it only works while both sides
     * segment on whitespace and happen to agree. Kept unchanged for
     * compatibility; prefer `start`/`end` below.
     */
    position: z.number().int().min(0).optional().nullable(),
    /**
     * Character offset of the focused span, in UTF-16 code units, into the
     * line the focus refers to (`sourceLine` for `sourceType: "source"`,
     * `targetLineDraft` for `"variant"`).
     *
     * Additive and optional: clients that do not send it fall back to the
     * `position` path, so older clients keep validating and behaving exactly
     * as before. Sending it removes the re-resolution guess entirely, which is
     * what makes non-whitespace (CJK) segmentation safe.
     */
    start: z.number().int().min(0).optional().nullable(),
    /** End offset (exclusive) of the focused span, in UTF-16 code units. */
    end: z.number().int().min(0).optional().nullable(),
    sourceType: z.enum(["variant", "source"]),
    variantId: z
      .union([z.literal(1), z.literal(2), z.literal(3)])
      .optional()
      .nullable(),
  }),
});

export type WordSuggestion = z.infer<typeof WordSuggestionSchema>;
export type SuggestionsResponse = z.infer<typeof SuggestionsResponseSchema>;
export type LineSuggestionsRequest = z.infer<typeof LineSuggestionsRequestSchema>;
export type TokenSuggestionsRequest = z.infer<typeof TokenSuggestionsRequestSchema>;
