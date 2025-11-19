import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  projectId: z.string().min(1, "projectId is required"),
  studentReflection: z
    .string()
    .min(10, "Reflection must be at least 10 characters")
    .max(5000, "Reflection cannot exceed 5000 characters"),
  completedLinesCount: z.number().int().min(0),
  totalLinesCount: z.number().int().min(1),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as any, { status });
}

function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log = (...a: any[]) =>
    console.log("[/api/journey/save-reflection]", requestId, ...a);

  try {
    // 1) Parse & validate body
    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await req.json());
      log("body ok", {
        threadId: body.threadId,
        projectId: body.projectId,
        completedLines: body.completedLinesCount,
        totalLines: body.totalLinesCount,
      });
    } catch (e: any) {
      log("bad body", e?.message);
      return err(400, "BAD_BODY", "Invalid request body", {
        details: String(e?.message ?? e),
      });
    }

    // 2) Auth
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set() {},
          remove() {},
        },
      }
    );

    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (authErr || !user) {
      log("unauthenticated", authErr?.message);
      return err(
        401,
        "UNAUTHENTICATED",
        "Please sign in to save reflection."
      );
    }

    // 3) Verify thread ownership
    const { data: thread, error: threadErr } = await supabase
      .from("chat_threads")
      .select("id,created_by,project_id")
      .eq("id", body.threadId)
      .single();

    if (threadErr || !thread) {
      log("thread_not_found", threadErr?.message);
      return err(404, "THREAD_NOT_FOUND", "Thread not found.");
    }

    if (thread.created_by !== user.id) {
      log("forbidden_thread", { userId: user.id, owner: thread.created_by });
      return err(403, "FORBIDDEN", "You do not have access to this thread.");
    }

    // 4) Verify project ownership (thread's project should match requested project)
    if (thread.project_id !== body.projectId) {
      log("project_mismatch", {
        threadProject: thread.project_id,
        requestProject: body.projectId,
      });
      return err(
        400,
        "PROJECT_MISMATCH",
        "Thread does not belong to specified project."
      );
    }

    // 5) Save reflection to database
    const { data: reflection, error: dbErr } = await supabase
      .from("journey_reflections")
      .insert({
        project_id: body.projectId,
        thread_id: body.threadId,
        student_reflection: body.studentReflection,
        completed_lines_count: body.completedLinesCount,
        total_lines_count: body.totalLinesCount,
        status: "reflection_only",
        created_by: user.id,
      })
      .select()
      .single();

    if (dbErr || !reflection) {
      log("db_insert_failed", dbErr?.message);
      return err(500, "DB_ERROR", "Failed to save reflection.", {
        details: String(dbErr?.message ?? dbErr),
      });
    }

    log("success", {
      reflectionId: reflection.id,
      ms: Date.now() - started,
    });

    return ok({
      id: reflection.id,
      threadId: reflection.thread_id,
      projectId: reflection.project_id,
      studentReflection: reflection.student_reflection,
      completedLinesCount: reflection.completed_lines_count,
      totalLinesCount: reflection.total_lines_count,
      status: reflection.status,
      createdAt: reflection.created_at,
    });
  } catch (e: any) {
    console.error("[/api/journey/save-reflection] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
