import { openai } from "@/lib/ai/openai";
import { ROUTER_SYSTEM } from "@/lib/ai/prompts";
import { ROUTER_MODEL } from "@/lib/models";
import { ROUTER_OUTPUT } from "@/lib/ai/schemas";
import { buildPromptHash, logLLMRequestPreview } from "@/lib/ai/promptHash";

export async function classifyIntentLLM(
  msg: string,
  phase: string
): Promise<null | { intent: string }> {
  if (process.env.NEXT_PUBLIC_FEATURE_ROUTER !== "1") return null;
  const user = JSON.stringify({ message: msg, phase });
  const prompt_hash = buildPromptHash({
    route: "router",
    model: ROUTER_MODEL,
    system: ROUTER_SYSTEM,
    user,
  });
  logLLMRequestPreview({
    route: "router",
    model: ROUTER_MODEL,
    system: ROUTER_SYSTEM,
    user,
    hash: prompt_hash,
  });
  const r = await openai.responses.create({
    model: ROUTER_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ROUTER_SYSTEM },
      { role: "user", content: user },
    ],
  } as unknown as Parameters<typeof openai.responses.create>[0]);
  try {
    const text = (r as unknown as { output_text?: string }).output_text ?? "{}";
    const json = JSON.parse(text);
    const parsed = ROUTER_OUTPUT.safeParse(json);
    if (parsed.success && "intent" in parsed.data)
      return { intent: (parsed.data as { intent?: string }).intent as string };
  } catch {}
  return null;
}
