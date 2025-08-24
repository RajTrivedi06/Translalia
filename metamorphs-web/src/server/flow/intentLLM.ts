import { getOpenAI } from "@/lib/ai/openai";

export async function classifyIntentLLM(
  msg: string,
  phase: string
): Promise<null | { intent: string }> {
  if (process.env.NEXT_PUBLIC_FEATURE_ROUTER !== "1") return null;
  const client = getOpenAI();
  const sys = [
    "Classify the user's message into one of:",
    "poem_input, interview_answer, looks_good, help, status, restart, out_of_scope.",
    'Return ONLY a compact JSON object: {"intent":"one_of_the_above"}.',
  ].join("\n");
  const user = JSON.stringify({ message: msg, phase });
  const r = await client.chat.completions.create({
    model: process.env.ROUTER_MODEL || "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });
  try {
    const json = JSON.parse(r.choices[0]?.message?.content ?? "{}");
    if (json && typeof json.intent === "string") return { intent: json.intent };
  } catch {}
  return null;
}
