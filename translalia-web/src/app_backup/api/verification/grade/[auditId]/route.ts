import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getServerClient } from "@/lib/supabaseServer";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ auditId: string }> }
) {
  const { auditId } = await params;
  const requestId = crypto.randomUUID();

  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const supabase = await getServerClient();

    // Fetch the specific audit record
    const { data: audit, error } = await supabase
      .from("prompt_audits")
      .select("*")
      .eq("id", auditId)
      .eq("created_by", user.id)
      .eq("stage", "line-verification-internal")
      .single();

    if (error || !audit) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Grade not found" } },
        { status: 404 }
      );
    }

    // Also fetch the thread to get source/translated lines
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("state, project_id")
      .eq("id", audit.thread_id)
      .single();

    const params = audit.params as any;
    const lineIndex = params?.lineIndex;
    const workshopLine = (thread?.state as any)?.workshop_lines?.[lineIndex];

    return NextResponse.json({
      audit: {
        id: audit.id,
        threadId: audit.thread_id,
        projectId: audit.project_id,
        stage: audit.stage,
        model: audit.model,
        createdAt: audit.created_at,
        meta: {
          lineIndex: params?.lineIndex,
          requestId: params?.requestId,
          duration: params?.duration,
        },
      },
      grade: params?.grade || null,
      prompt: {
        system: audit.prompt_system,
        user: audit.prompt_user,
      },
      lineData: workshopLine
        ? {
            original: workshopLine.original,
            translated: workshopLine.translated,
            selections: workshopLine.selections,
            wordOptions: workshopLine.word_options,
          }
        : null,
    });
  } catch (error) {
    console.error("[verification/grade]", requestId, "Error:", error);
    return NextResponse.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch grade" },
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
