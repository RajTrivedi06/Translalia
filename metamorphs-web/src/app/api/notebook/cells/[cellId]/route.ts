import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { NotebookCell, NotebookCellUpdate } from "@/types/notebook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  lineIndex: z.number().int().min(0),
  updates: z.object({
    translation: z.string().optional(),
    notes: z.array(z.string()).optional(),
    footnotes: z.array(z.object({
      word: z.string(),
      note: z.string(),
    })).optional(),
    lockedWords: z.array(z.number().int()).optional(),
    status: z.enum(['draft', 'reviewed', 'locked']).optional(),
  }),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as any, { status });
}

function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * PATCH /api/notebook/cells/[cellId]
 * Updates a specific cell (translation, notes, locks, etc.)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ cellId: string }> }
) {
  const requestId = crypto.randomUUID();
  const log = (...a: any[]) => console.log("[/api/notebook/cells/[cellId]]", requestId, ...a);

  try {
    const { cellId } = await params;

    // 1) Parse body
    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await req.json());
      log("body ok", { threadId: body.threadId, lineIndex: body.lineIndex });
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

    // 5) Validate locked words constraint
    if (currentCell.translation?.status === 'locked' && body.updates.translation) {
      log("locked_cell_edit_attempt");
      return err(409, "CELL_LOCKED", "Cannot edit translation of locked cell. Unlock it first.");
    }

    // If trying to change locked words on a locked cell
    if (
      currentCell.translation?.status === 'locked' &&
      body.updates.lockedWords &&
      JSON.stringify(body.updates.lockedWords) !== JSON.stringify(currentCell.translation?.lockedWords || [])
    ) {
      log("locked_words_change_attempt");
      return err(409, "CELL_LOCKED", "Cannot change locked words on locked cell.");
    }

    // 6) Merge updates
    const updatedCell = {
      ...currentCell,
      translation: {
        text: body.updates.translation ?? currentCell.translation?.text ?? '',
        status: body.updates.status ?? currentCell.translation?.status ?? 'draft',
        lockedWords: body.updates.lockedWords ?? currentCell.translation?.lockedWords ?? [],
      },
      notes: body.updates.notes ?? currentCell.notes ?? [],
      footnotes: body.updates.footnotes ?? currentCell.footnotes ?? [],
      updatedAt: new Date().toISOString(),
      createdAt: currentCell.createdAt || new Date().toISOString(),
    };

    // 7) Update state in DB
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
      return err(500, "UPDATE_FAILED", "Failed to update cell.");
    }

    // 8) Build response cell
    const poemAnalysis = state.poem_analysis || {};
    const sourceLines = poemAnalysis.source_lines || [];
    const sourceLine = sourceLines[body.lineIndex];

    const responseCell: NotebookCell = {
      id: `cell-${body.lineIndex}`,
      lineIndex: body.lineIndex,
      source: {
        text: sourceLine?.text || sourceLine || '',
        language: poemAnalysis.language || 'unknown',
        dialect: poemAnalysis.dialect || undefined,
      },
      translation: {
        text: updatedCell.translation.text,
        status: updatedCell.translation.status,
        lockedWords: updatedCell.translation.lockedWords,
      },
      notes: updatedCell.notes,
      footnotes: updatedCell.footnotes,
      prismaticVariants: updatedCell.prismaticVariants || undefined,
      metadata: {
        createdAt: updatedCell.createdAt,
        updatedAt: updatedCell.updatedAt,
        wordCount: updatedCell.translation.text.split(/\s+/).filter(Boolean).length,
      },
    };

    log("success");
    return ok({ cell: responseCell });
  } catch (e: any) {
    console.error("[/api/notebook/cells/[cellId]] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
