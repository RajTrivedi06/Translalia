import { z } from "zod";

export const EnhancerPayloadSchema = z.object({
  plain_english_summary: z.string(),
  poem_excerpt: z.string(),
  enhanced_request: z.record(z.any()),
  warnings: z.array(z.string()).optional(),
});

export type EnhancerPayload = z.infer<typeof EnhancerPayloadSchema>;

export const TranslatorOutputSchema = z.object({
  versionA: z.string(), // poem text
  notes: z.array(z.string()).min(1).max(10),
});

export type TranslatorOutput = z.infer<typeof TranslatorOutputSchema>;
