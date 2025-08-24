import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { getThreadState } from "@/server/threadState";
import { computeNextQuestion } from "@/server/flow/questions";

const Query = z.object({ threadId: z.string().uuid() });

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = Query.safeParse({
      threadId: url.searchParams.get("threadId"),
    });
    if (!parsed.success)
      return NextResponse.json({ error: "threadId required" }, { status: 400 });

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
    const nextQ = computeNextQuestion(state);

    return NextResponse.json({
      ok: true,
      phase: state.phase ?? "welcome",
      nextQuestion: nextQ ? { id: nextQ.id, prompt: nextQ.prompt } : null,
      snapshot: {
        poem_excerpt: state.poem_excerpt ?? "",
        collected_fields: state.collected_fields ?? {},
      },
    });
  } catch (e: unknown) {
    const message = (e as { message?: string })?.message || "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
