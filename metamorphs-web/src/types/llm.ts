import { z } from "zod";
import { ENHANCER_PAYLOAD } from "@/lib/ai/schemas";
// NOTE(cursor): Use centralized Enhancer schema
export type EnhancerPayload = z.infer<typeof ENHANCER_PAYLOAD>;

export const TranslatorOutputSchema = z.object({
  versionA: z.string(), // poem text
  notes: z.array(z.string()).min(1).max(10),
});

export type TranslatorOutput = z.infer<typeof TranslatorOutputSchema>;
