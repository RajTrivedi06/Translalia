import { z } from "zod";

export const TranslatorOutputSchema = z.object({
  versionA: z.string(), // poem text
  notes: z.array(z.string()).min(1).max(10),
});

export type TranslatorOutput = z.infer<typeof TranslatorOutputSchema>;
