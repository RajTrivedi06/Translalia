import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";
import { SessionState } from "@/types/sessionState";
import { computeNextQuestion, firstQuestion } from "@/server/flow/questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const threadId = new URL(req.url).searchParams.get("threadId");
  if (!threadId) {
    return NextResponse.json(
      { ok: false, code: "MISSING_THREAD_ID" },
      { status: 400 }
    );
  }

  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
  const { user, sb } = guard;

  const { data: th, error: thErr } = await sb
    .from("chat_threads")
    .select("id, project_id, state")
    .eq("id", threadId)
    .single();

  if (thErr || !th) {
    return NextResponse.json(
      { ok: false, code: "THREAD_NOT_FOUND" },
      { status: 404 }
    );
  }

  const { data: proj, error: projErr } = await sb
    .from("projects")
    .select("id, owner_id")
    .eq("id", th.project_id)
    .single();

  if (projErr || !proj) {
    return NextResponse.json(
      { ok: false, code: "PROJECT_NOT_FOUND" },
      { status: 404 }
    );
  }
  if (proj.owner_id !== user.id) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN_THREAD" },
      { status: 403 }
    );
  }

  const rawState = (th.state as Record<string, unknown>) || {};
  const state = rawState as unknown as SessionState;

  const has_poem = Boolean(state.poem_excerpt);
  // Default to "welcome" if no explicit phase and no poem yet
  const phase = state.phase || (has_poem ? "interviewing" : "welcome");

  // Compute next question only when interviewing
  let nextQuestion: { id: string; prompt: string } | null = null;
  if (phase === "interviewing") {
    const q = computeNextQuestion({
      ...state,
      collected_fields: state.collected_fields || {},
    } as SessionState);
    const picked = q ?? firstQuestion();
    nextQuestion = picked ? { id: picked.id, prompt: picked.prompt } : null;
  }

  return NextResponse.json({
    ok: true,
    threadId,
    projectId: th.project_id,
    phase,
    nextQuestion,
    snapshot: {
      poem_excerpt: state.poem_excerpt || "",
      collected_fields: state.collected_fields || {},
    },
  });
}
