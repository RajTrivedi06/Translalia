import { z } from "zod";

export const InterviewFields = z.object({
  target_language: z
    .string()
    .min(1)
    .describe("e.g., Moroccan Arabic, Yoruba, AAVE"),
  dialect_or_register: z.string().optional(),
  tone_style: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  glossary: z
    .array(
      z.object({
        term: z.string(),
        translation: z.string().optional(),
        note: z.string().optional(),
        dialect_marker: z.string().optional(),
        source: z.string().optional(),
      })
    )
    .optional(),
});

export type Interview = z.infer<typeof InterviewFields>;

export type Gap =
  | "target_language"
  | "dialect_or_register"
  | "tone_style"
  | "glossary_missing"
  | "glossary_ambiguous";

export function computeGaps(f: Partial<Interview>): Gap[] {
  const gaps: Gap[] = [];
  if (!f?.target_language?.trim()) gaps.push("target_language");
  if (!f?.dialect_or_register?.trim()) gaps.push("dialect_or_register");
  if (!f?.tone_style?.trim()) gaps.push("tone_style");
  const g = f?.glossary ?? [];
  if (!g?.length) gaps.push("glossary_missing");
  else if (g.some((x) => !x.translation && !x.note))
    gaps.push("glossary_ambiguous");
  return gaps;
}
