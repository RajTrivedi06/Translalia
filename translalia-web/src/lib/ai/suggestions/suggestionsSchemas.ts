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
    position: z.number().int().min(0).optional().nullable(),
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
