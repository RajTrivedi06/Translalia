import { openai } from "@/lib/ai/openai";
import { ENHANCER_SYSTEM } from "@/lib/ai/prompts";
import { ENHANCER_MODEL } from "@/lib/models";
import { ENHANCER_PAYLOAD, type EnhancerPayload } from "@/lib/ai/schemas";
import { buildPromptHash, logLLMRequestPreview } from "@/lib/ai/promptHash";

// NOTE(cursor): Centralized schema imported; remove local inline schema

export async function enhance({
  excerpt,
  fields,
  glossary,
}: {
  excerpt: string;
  fields: Record<string, unknown>;
  glossary?: Array<Record<string, unknown>>;
}): Promise<
  | { ok: true; data: EnhancerPayload; retry?: boolean; prompt_hash: string }
  | { ok: false; error: string; prompt_hash?: string }
> {
  const user = `POEM_EXCERPT:\n${excerpt}\n\nCOLLECTED_FIELDS:\n${JSON.stringify(
    fields
  )}\n\nOPTIONAL_GLOSSARY:\n${JSON.stringify(glossary ?? [])}`;
  const prompt_hash = buildPromptHash({
    route: "enhancer",
    model: ENHANCER_MODEL,
    system: ENHANCER_SYSTEM,
    user,
  });
  logLLMRequestPreview({
    route: "enhancer",
    model: ENHANCER_MODEL,
    system: ENHANCER_SYSTEM,
    user,
    hash: prompt_hash,
  });
  const base = {
    model: ENHANCER_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" } as const,
  };

  const r1 = await openai.responses.create({
    ...base,
    messages: [
      { role: "system", content: ENHANCER_SYSTEM },
      { role: "user", content: user },
    ] as const,
  } as unknown as Parameters<typeof openai.responses.create>[0]);
  const t1 = (r1 as unknown as { output_text?: string }).output_text ?? "";
  try {
    return {
      ok: true,
      data: ENHANCER_PAYLOAD.parse(JSON.parse(t1)),
      prompt_hash,
    };
  } catch {
    const r2 = await openai.responses.create({
      ...base,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            ENHANCER_SYSTEM +
            "\nReturn STRICT valid JSON. If unsure, set warnings.",
        },
        {
          role: "user",
          content: `Please re-emit STRICT JSON fixing only structural errors from:\n${t1.slice(
            0,
            3500
          )}`,
        },
      ],
    } as unknown as Parameters<typeof openai.responses.create>[0]);
    const t2 = (r2 as unknown as { output_text?: string }).output_text ?? "";
    try {
      return {
        ok: true,
        data: ENHANCER_PAYLOAD.parse(JSON.parse(t2)),
        retry: true,
        prompt_hash,
      };
    } catch {
      return {
        ok: false,
        error: "Enhancer JSON invalid after retry",
        prompt_hash,
      };
    }
  }
}
