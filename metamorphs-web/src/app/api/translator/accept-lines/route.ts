import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { getThreadState, appendLedger } from "@/server/threadState";
import { moderateText } from "@/lib/ai/moderation";
import { bestEffortJourneyInsert } from "@/server/flow/journeyLog";

const Body = z.object({
  threadId: z.string().uuid(),
  selections: z
    .array(
      z.object({ index: z.number().int().min(0), text: z.string().min(1) })
    )
    .min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  const { threadId, selections } = parsed.data;

  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userRes.user.id;

  const { data: th, error: thErr } = await supabase
    .from("chat_threads")
    .select("id, project_id")
    .eq("id", threadId)
    .single();
  if (thErr || !th)
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const state = await getThreadState(threadId);
  if (!state || !state.poem_excerpt)
    return NextResponse.json(
      { error: "Thread not initialized" },
      { status: 409 }
    );

  const combined = selections.map((s) => s.text).join("\n");
  const mod = await moderateText(combined);
  if (mod.flagged) {
    return NextResponse.json(
      {
        ok: false,
        blocked: true,
        flagged: true,
        categories: mod.categories,
        error: "Selected lines flagged by moderation; not saved.",
      },
      { status: 400 }
    );
  }

  for (const s of selections) {
    await supabase.rpc("accept_line", {
      p_thread_id: threadId,
      p_line_index: s.index + 1,
      p_new_text: s.text,
      p_actor: userId,
    });
  }

  await appendLedger(threadId, {
    ts: new Date().toISOString(),
    kind: "accept",
    note: `Accepted ${selections.length} line(s) from translator`,
  });

  await bestEffortJourneyInsert({
    project_id: th.project_id,
    kind: "accept_line",
    summary: `Accepted ${selections.length} line(s)`,
    meta: { thread_id: threadId, selections },
  });

  return NextResponse.json({ ok: true });
}
