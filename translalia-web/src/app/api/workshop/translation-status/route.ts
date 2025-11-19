import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { getTranslationJob } from "@/lib/workshop/jobState";
import { runTranslationTick } from "@/lib/workshop/runTranslationTick";
import { summarizeTranslationJob } from "@/lib/workshop/translationProgress";

const QuerySchema = z.object({
  threadId: z.string().uuid(),
  advance: z.enum(["true", "false"]).optional().default("true"),
});

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  let query: z.infer<typeof QuerySchema>;
  try {
    query = QuerySchema.parse(params);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details:
          error instanceof Error ? error.message : "Unable to parse request",
      },
      { status: 400 }
    );
  }

  const { threadId, advance } = query;

  const supabase = await supabaseServer();
  const { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select("id, created_by")
    .eq("id", threadId)
    .single();

  if (threadError || !thread) {
    return NextResponse.json(
      { error: "Thread not found or unauthorized" },
      { status: 404 }
    );
  }

  if (thread.created_by !== user.id) {
    return NextResponse.json(
      { error: "You do not have access to this thread" },
      { status: 403 }
    );
  }

  let tickResult = null;
  if (advance === "true") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 4000,
    });
  }

  const job = await getTranslationJob(threadId);
  const progress = summarizeTranslationJob(job);

  return NextResponse.json({
    ok: true,
    job,
    tick: tickResult,
    progress,
  });
}
