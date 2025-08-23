import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI } from "@/lib/ai/openai";
import { stableHash, cacheGet, cacheSet } from "@/lib/ai/cache";
import { moderateText } from "@/lib/ai/moderation";
import { supabaseServer } from "@/lib/supabaseServer";
import { getThreadState, patchThreadState } from "@/server/threadState";
import { EnhancerPayloadSchema } from "@/types/llm";

const Body = z.object({ threadId: z.string().uuid() });

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_FEATURE_ENHANCER !== "1") {
    return new NextResponse("Feature disabled", { status: 403 });
  }
  const body = await req.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );

  const { threadId } = parsed.data;
  const supabase = await supabaseServer();
  const { data: th, error: thErr } = await supabase
    .from("chat_threads")
    .select("id, project_id")
    .eq("id", threadId)
    .single();
  if (thErr || !th)
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const state = await getThreadState(threadId);
  const poem = (state.poem_excerpt ?? "").trim();
  const fields = state.collected_fields ?? {};
  if (!poem)
    return NextResponse.json(
      { error: "No poem excerpt in state" },
      { status: 409 }
    );

  const pre = await moderateText(poem);
  if (pre.flagged) {
    return NextResponse.json(
      { error: "Poem content flagged by moderation; cannot enhance." },
      { status: 400 }
    );
  }

  const payload = { poem, fields };
  const key = "enhancer:" + stableHash(payload);
  const cached = await cacheGet<unknown>(key);
  if (cached) {
    try {
      const parsedPlan = EnhancerPayloadSchema.parse(cached);
      await patchThreadState(threadId, {
        enhanced_request: parsedPlan.enhanced_request,
        plain_english_summary: parsedPlan.plain_english_summary,
      });
    } catch {}
    return NextResponse.json({ ok: true, plan: cached, cached: true });
  }

  const system = [
    "You are the Prompt Enhancer for Metamorphs, a decolonial poetry-translation workspace.",
    "INPUTS provided:",
    "- POEM_EXCERPT: verbatim text (preserve spacing/line breaks).",
    "- COLLECTED_FIELDS: JSON of user choices.",
    "TASK: Produce a human-readable plan and a structured enhanced request.",
    "Return a SINGLE JSON object named ENHANCER_PAYLOAD with keys:",
    "plain_english_summary, poem_excerpt (echo verbatim), enhanced_request, warnings[].",
    "Rules: keep decolonial stance, preserve excerpt exactly, list any defaults as _assumptions inside enhanced_request.",
    "Never return anything outside ENHANCER_PAYLOAD.",
  ].join("\n");

  const user = JSON.stringify({
    POEM_EXCERPT: poem,
    COLLECTED_FIELDS: fields,
  });

  const openai = getOpenAI();
  const resp = await openai.chat.completions.create({
    model: process.env.ENHANCER_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });

  const text = resp.choices[0]?.message?.content || "{}";
  let planRaw: unknown;
  try {
    planRaw = JSON.parse(text).ENHANCER_PAYLOAD ?? JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Enhancer returned non-JSON" },
      { status: 500 }
    );
  }

  const plan = EnhancerPayloadSchema.parse(planRaw);

  await patchThreadState(threadId, {
    plain_english_summary: plan.plain_english_summary,
    enhanced_request: plan.enhanced_request,
  });

  await cacheSet(key, plan, 3600);

  return NextResponse.json({ ok: true, plan, usage: resp.usage });
}
