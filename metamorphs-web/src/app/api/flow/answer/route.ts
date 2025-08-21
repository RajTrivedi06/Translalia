import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { getThreadState, patchThreadState } from "@/server/threadState";
import {
  computeNextQuestion,
  processAnswer,
  QUESTIONS,
  type QuestionId,
} from "@/server/flow/questions";
import { bestEffortJourneyInsert } from "@/server/flow/journeyLog";

const BodySchema = z.object({
  threadId: z.string().uuid(),
  questionId: z.enum([
    "q1_target",
    "q2_form",
    "q3_tone",
    "q4_trans",
    "q5_keep",
    "q6_avoid",
    "q7_line",
    "q8_refs",
  ]),
  answer: z.string().min(1),
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
  const { threadId, questionId, answer } = parsed.data;

  const supabase = await supabaseServer();
  const { data: th, error: thErr } = await supabase
    .from("chat_threads")
    .select("id, project_id")
    .eq("id", threadId)
    .single();
  if (thErr || !th) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const state = await getThreadState(threadId);

  // Guard: enforce Q1 required
  if (questionId === "q1_target") {
    const a = answer.trim();
    if (!a || a.toLowerCase() === "skip") {
      return NextResponse.json(
        {
          ok: false,
          error: "Target language/variety is required.",
          prompt: QUESTIONS[0].prompt,
        },
        { status: 400 }
      );
    }
  }

  // Apply answer → state
  let updated;
  try {
    updated = processAnswer(questionId as QuestionId, answer, state);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid answer";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  // Persist
  await patchThreadState(threadId, updated);

  // Log (best-effort)
  await bestEffortJourneyInsert({
    project_id: th.project_id,
    kind: "interview_answer",
    summary: `Answered ${questionId}`,
    meta: { thread_id: threadId, answer },
  });

  // Next step?
  const nextQ = computeNextQuestion(updated);
  if (nextQ) {
    return NextResponse.json({
      ok: true,
      phase: "interviewing",
      nextQuestion: { id: nextQ.id, prompt: nextQ.prompt },
      snapshot: updated.collected_fields ?? {},
    });
  }

  // Plan gate reached (no LLM yet): freeze inputs and enter await_plan_confirm
  await patchThreadState(threadId, { phase: "await_plan_confirm" });

  return NextResponse.json({
    ok: true,
    phase: "await_plan_confirm",
    planPreview: {
      poem_excerpt: updated.poem_excerpt ?? "",
      collected_fields: updated.collected_fields ?? {},
      readyForEnhancer: true, // UI will call /api/enhancer in Phase 5 when flag ON
    },
  });
}
