import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createTranslationJob,
  getTranslationJob,
} from "@/lib/workshop/jobState";
import {
  loadThreadContext,
  runTranslationTick,
} from "@/lib/workshop/runTranslationTick";
import { summarizeTranslationJob } from "@/lib/workshop/translationProgress";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  runInitialTick: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
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

  const { threadId, runInitialTick } = body;

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

  const context = await loadThreadContext(threadId);

  const job = await createTranslationJob(
    {
      threadId,
      poem: context.rawPoem,
      chunks: context.stanzaResult.stanzas, // chunks are the new primary field
      stanzas: context.stanzaResult.stanzas, // legacy fallback
    },
    {
      maxConcurrent: undefined,
      maxStanzasPerTick: undefined,
      guidePreferences: context.guideAnswers as Record<string, unknown>,
    }
  );

  let tickResult = null;
  if (runInitialTick && job.status !== "completed") {
    tickResult = await runTranslationTick(threadId, {
      maxProcessingTimeMs: 6000,
    });
  }

  const latestJob = await getTranslationJob(threadId);
  const progress = summarizeTranslationJob(latestJob);

  return NextResponse.json({
    ok: true,
    job: latestJob,
    tick: tickResult,
    progress,
  });
}
