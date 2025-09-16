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

  const r = await openai.responses.create({
    model: ROUTER_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER },
    ],
  } as unknown as Parameters<typeof openai.responses.create>[0]);

  const text =
    (
      r as unknown as {
        output_text?: string;
        content?: Array<{ text?: string }>;
      }
    ).output_text ??
    (r as unknown as { content?: Array<{ text?: string }> }).content?.[0]
      ?.text ??
    "{}";
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
