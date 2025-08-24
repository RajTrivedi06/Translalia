import { z } from "zod";

export const TranslatorParsedSchema = z.object({
  lines: z.array(z.string()),
  notes: z.array(z.string()).min(1).max(10),
});

export type TranslatorParsed = z.infer<typeof TranslatorParsedSchema>;

/** Strictly parse the model output with markers; tolerate minor drift. */
export function parseTranslatorOutput(raw: string): TranslatorParsed {
  const text = raw ?? "";
  const afterA = text.split(/---VERSION A---/i)[1] ?? "";
  const [poemRaw, notesRaw] = afterA.split(/---NOTES---/i);
  const poem = (poemRaw ?? "").trim();
  const notesSection = (notesRaw ?? "").trim();

  const lines = poem
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l, i, arr) => !(i === arr.length - 1 && l === ""));

  const notes = notesSection
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•]\s?/, "").trim())
    .filter(Boolean)
    .slice(0, 10);

  return TranslatorParsedSchema.parse({ lines, notes });
}
