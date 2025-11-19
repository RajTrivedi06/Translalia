import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { isSmartInterviewLLMEnabled } from "@/lib/flags/interview";
import { ROUTER_MODEL } from "@/lib/models";
import { openai } from "@/lib/ai/openai";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  if (!isSmartInterviewLLMEnabled())
    return NextResponse.json({ error: "Feature disabled" }, { status: 404 });

  const { gap, baseQuestion, context } = await req.json();

  const SYSTEM = `You rewrite a single clarifying question for a translation interview.
Return ONLY valid JSON: {"question": "<concise>"}.
Be culturally respectful. Avoid prescriptive standardization.`;

  const USER = `GAP=${gap}
BASE_QUESTION="${baseQuestion}"
CONTEXT=${JSON.stringify(context ?? {})}`;

  // Use ROUTER_MODEL (defaults to gpt-5-nano) with fallback
  let modelToUse = ROUTER_MODEL;
  let completion;

  // GPT-5 models don't support temperature, top_p, frequency_penalty, etc.
  const isGpt5 = modelToUse.startsWith('gpt-5');

  try {
    if (isGpt5) {
      // GPT-5: No temperature or other sampling parameters
      completion = await openai.chat.completions.create({
        model: modelToUse,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: USER },
        ],
      });
    } else {
      // GPT-4: Include temperature
      completion = await openai.chat.completions.create({
        model: modelToUse,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: USER },
        ],
      });
    }
  } catch (modelError: any) {
    // If model not found or unsupported, fallback to gpt-4o
    const shouldFallback =
      modelError?.error?.code === 'model_not_found' ||
      modelError?.status === 404 ||
      modelError?.status === 400;

    if (shouldFallback) {
      console.warn(`[interview] Model ${modelToUse} fallback to gpt-4o:`, modelError?.error?.code || modelError?.error?.message || 'error');
      modelToUse = "gpt-4o";
      completion = await openai.chat.completions.create({
        model: modelToUse,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: USER },
        ],
      });
    } else {
      throw modelError;
    }
  }

  const text = completion.choices[0]?.message?.content ?? "{}";
  try {
    const obj = JSON.parse(text);
    if (!obj?.question) throw new Error("Missing question");
    return NextResponse.json({ question: String(obj.question) });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON from LLM" },
      { status: 502 }
    );
  }
}
