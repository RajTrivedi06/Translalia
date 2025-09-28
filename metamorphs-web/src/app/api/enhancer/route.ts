import { NextResponse } from "next/server";
import { z } from "zod";
import { stableHash, cacheGet, cacheSet } from "@/lib/ai/cache";
import { moderateText } from "@/lib/ai/moderation";
import { supabaseServer } from "@/lib/supabaseServer";
import { getThreadState, patchThreadState } from "@/server/threadState";
import { ENHANCER_PAYLOAD } from "@/lib/ai/schemas";
import { enhance } from "@/lib/ai/enhance";
import { respondLLMError } from "@/lib/http/errors";

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
      const parsedPlan = ENHANCER_PAYLOAD.parse(cached);
      await patchThreadState(threadId, {
        enhanced_request: parsedPlan.enhanced_request,
        // NOTE(cursor): Back-compat for older cache objects
        plain_english_summary:
          (parsedPlan as unknown as { plain_english_summary?: string })
            .plain_english_summary ?? parsedPlan.summary,
      });
    } catch {}
    return NextResponse.json({ ok: true, plan: cached, cached: true });
  }

  try {
    const r = await enhance({ excerpt: poem, fields, glossary: [] });
    if (!r.ok) {
      return NextResponse.json(
        { error: r.error, prompt_hash: r.prompt_hash },
        { status: 502 }
      );
    }
    const plan = ENHANCER_PAYLOAD.parse(r.data);

    await patchThreadState(threadId, {
      plain_english_summary: plan.summary,
      enhanced_request: plan.enhanced_request,
    });

    await cacheSet(key, plan, 3600);

    return NextResponse.json({ ok: true, plan, prompt_hash: r.prompt_hash });
  } catch (e) {
    return respondLLMError(e);
  }
}
