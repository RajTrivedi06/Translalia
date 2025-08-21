import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { getThreadState, patchThreadState } from "@/server/threadState";
import { bestEffortJourneyInsert } from "@/server/flow/journeyLog";

const Body = z.object({ threadId: z.string().uuid() });

export async function POST(req: Request) {
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
  if (state.phase !== "await_plan_confirm") {
    return NextResponse.json({ error: "Not at plan gate" }, { status: 409 });
  }

  await patchThreadState(threadId, { phase: "translating" });

  await bestEffortJourneyInsert({
    project_id: th.project_id,
    kind: "plan_confirmed",
    summary: "Plan confirmed (no LLM yet)",
    meta: {
      thread_id: threadId,
      snapshot: {
        poem_excerpt: state.poem_excerpt,
        collected_fields: state.collected_fields,
      },
    },
  });

  return NextResponse.json({ ok: true, phase: "translating" });
}
