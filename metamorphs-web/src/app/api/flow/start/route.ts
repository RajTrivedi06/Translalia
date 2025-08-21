import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { patchThreadState, getThreadState } from "@/server/threadState";
import { firstQuestion } from "@/server/flow/questions";
import { bestEffortJourneyInsert } from "@/server/flow/journeyLog";

const BodySchema = z.object({
  threadId: z.string().uuid(),
  poem: z.string().min(1), // verbatim text; preserve line breaks on UI
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { threadId, poem } = parsed.data;

  const supabase = await supabaseServer();
  // Resolve project for logging
  const { data: th, error: thErr } = await supabase
    .from("chat_threads")
    .select("id, project_id")
    .eq("id", threadId)
    .single();
  if (thErr || !th) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Reset relevant state and store poem
  const state = await getThreadState(threadId);
  await patchThreadState(threadId, {
    ...state,
    phase: "interviewing",
    poem_excerpt: poem, // store verbatim
    collected_fields: {}, // reset interview
    enhanced_request: undefined,
    plain_english_summary: undefined,
  });

  await bestEffortJourneyInsert({
    project_id: th.project_id,
    kind: "interview_started",
    summary: "Interview started",
    meta: { thread_id: threadId },
  });

  const q = firstQuestion();

  return NextResponse.json({
    ok: true,
    phase: "interviewing",
    nextQuestion: { id: q.id, prompt: q.prompt },
  });
}
