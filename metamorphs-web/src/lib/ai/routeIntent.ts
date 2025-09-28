import { openai } from "@/lib/ai/openai";
import { ROUTER_SYSTEM } from "@/lib/ai/prompts";
import { ROUTER_MODEL } from "@/lib/models";
import { ROUTER_OUTPUT, type RouterOutput } from "@/lib/ai/schemas";
import { buildPromptHash, logLLMRequestPreview } from "@/lib/ai/promptHash";

export async function classifyIntent(utterance: string): Promise<
  | { ok: true; data: RouterOutput; prompt_hash: string }
  | {
      ok: false;
      error: string;
      prompt_hash?: string;
    }
> {
  const prompt_hash = buildPromptHash({
    route: "router",
    model: ROUTER_MODEL,
    system: ROUTER_SYSTEM,
    user: utterance,
  });
  logLLMRequestPreview({
    route: "router",
    model: ROUTER_MODEL,
    system: ROUTER_SYSTEM,
    user: utterance,
    hash: prompt_hash,
  });

  const r = await openai.responses.create({
    model: ROUTER_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ROUTER_SYSTEM },
      { role: "user", content: utterance },
    ],
  } as unknown as Parameters<typeof openai.responses.create>[0]);

  const text = (r as unknown as { output_text?: string }).output_text ?? "{}";
  try {
    const parsed = ROUTER_OUTPUT.parse(JSON.parse(text));
    return { ok: true, data: parsed, prompt_hash };
  } catch {
    return { ok: false, error: "Router JSON invalid", prompt_hash };
  }
}
