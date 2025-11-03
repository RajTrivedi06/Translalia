export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Implementation is assumed to exist elsewhere; this file just sets route hints per task.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { NotebookCell } from "@/types/notebook";

const QuerySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as any, { status });
}

function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * GET /api/notebook/cells?threadId=xxx
 * Fetches all notebook cells for a thread
 */
export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (...a: any[]) =>
    console.log("[/api/notebook/cells]", requestId, ...a);

  try {
    // 1) Parse query params
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get("threadId");

    let params: z.infer<typeof QuerySchema>;
    try {
      params = QuerySchema.parse({ threadId });
      log("query ok", { threadId: params.threadId });
    } catch (e: any) {
      log("bad query", e?.message);
      return err(400, "BAD_QUERY", "Invalid query params", {
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
      return err(401, "UNAUTHENTICATED", "Please sign in.");
    }

    // 3) Fetch thread with state
    const { data: thread, error: threadErr } = await supabase
      .from("chat_threads")
      .select("id,created_by,state")
      .eq("id", params.threadId)
      .single();

    if (threadErr || !thread) {
      log("thread_not_found", threadErr?.message);
      return err(404, "THREAD_NOT_FOUND", "Thread not found.");
    }

    if (thread.created_by !== user.id) {
      log("forbidden", { userId: user.id, owner: thread.created_by });
      return err(403, "FORBIDDEN", "You do not have access to this thread.");
    }

    // 4) Extract data from state
    const state = (thread.state as any) || {};
    const poemAnalysis = state.poem_analysis || {};
    const sourceLines = poemAnalysis.source_lines || [];
    // workshopLines is stored as Record<number, WorkshopLine>, not an array
    const workshopLines = state.workshop_lines || {};
    const notebookCells = state.notebook_cells || {};

    // 5) Build cells array
    const cells: NotebookCell[] = sourceLines.map(
      (sourceLine: any, index: number) => {
        const workshopLine = workshopLines[index];
        const cellData = notebookCells[index] || {};

        // workshopLine structure: { original, translated, selections, completedAt }
        const translatedText =
          workshopLine?.translated || workshopLine?.text || "";

        // Determine status
        let status: NotebookCell["translation"]["status"] = "untranslated";
        if (cellData.translation?.status) {
          status = cellData.translation.status;
        } else if (translatedText) {
          status = "draft";
        }

        return {
          id: `cell-${index}`,
          lineIndex: index,
          source: {
            text: sourceLine.text || sourceLine,
            language: poemAnalysis.language || "unknown",
            dialect: poemAnalysis.dialect || undefined,
          },
          translation: {
            text: cellData.translation?.text || translatedText,
            status,
            lockedWords: cellData.translation?.lockedWords || [],
          },
          notes: cellData.notes || [],
          footnotes: cellData.footnotes || [],
          prismaticVariants: cellData.prismaticVariants || undefined,
          metadata: {
            createdAt:
              cellData.createdAt ||
              workshopLine?.completedAt ||
              new Date().toISOString(),
            updatedAt:
              cellData.updatedAt ||
              workshopLine?.completedAt ||
              new Date().toISOString(),
            wordCount: (cellData.translation?.text || translatedText)
              .split(/\s+/)
              .filter(Boolean).length,
          },
        };
      }
    );

    log("success", { cellCount: cells.length });
    return ok({ cells });
  } catch (e: any) {
    console.error("[/api/notebook/cells] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
