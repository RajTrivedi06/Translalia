import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  lineIndex: z.number().int().min(0),
  wordPositions: z.array(z.number().int().min(0)),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as any, { status });
}

function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * POST /api/notebook/locks
 * Lock/unlock specific words in a cell to preserve dialect choices
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (...a: any[]) => console.log("[/api/notebook/locks]", requestId, ...a);

  try {
    // 1) Parse body
    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await req.json());
      log("body ok", { threadId: body.threadId, lineIndex: body.lineIndex, locks: body.wordPositions.length });
    } catch (e: any) {
      log("bad body", e?.message);
      return err(400, "BAD_BODY", "Invalid request body", { details: String(e?.message ?? e) });
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

    // 3) Fetch thread
    const { data: thread, error: threadErr } = await supabase
      .from("chat_threads")
      .select("id,created_by,state")
      .eq("id", body.threadId)
      .single();

    if (threadErr || !thread) {
      log("thread_not_found", threadErr?.message);
      return err(404, "THREAD_NOT_FOUND", "Thread not found.");
    }

    if (thread.created_by !== user.id) {
      log("forbidden", { userId: user.id, owner: thread.created_by });
      return err(403, "FORBIDDEN", "You do not have access to this thread.");
    }

    // 4) Get current state
    const state = (thread.state as any) || {};
    const notebookCells = state.notebook_cells || {};
    const currentCell = notebookCells[body.lineIndex] || {};

    // 5) Validate cell is not fully locked
    if (currentCell.translation?.status === 'locked') {
      log("cell_locked");
      return err(409, "CELL_LOCKED", "Cannot modify locks on a locked cell. Unlock the cell first.");
    }

    // 6) Update locked words
    const updatedCell = {
      ...currentCell,
      translation: {
        text: currentCell.translation?.text || '',
        status: currentCell.translation?.status || 'draft',
        lockedWords: body.wordPositions,
      },
      updatedAt: new Date().toISOString(),
      createdAt: currentCell.createdAt || new Date().toISOString(),
    };

    // 7) Persist to DB
    const newState = {
      ...state,
      notebook_cells: {
        ...notebookCells,
        [body.lineIndex]: updatedCell,
      },
    };

    const { error: updateErr } = await supabase
      .from("chat_threads")
      .update({ state: newState })
      .eq("id", body.threadId);

    if (updateErr) {
      log("update_fail", updateErr.message);
      return err(500, "UPDATE_FAILED", "Failed to update locks.");
    }

    log("success", { lockedWords: body.wordPositions });
    return ok({ lockedWords: body.wordPositions });
  } catch (e: any) {
    console.error("[/api/notebook/locks] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
