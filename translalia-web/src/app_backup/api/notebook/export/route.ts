import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  format: z.enum(['txt', 'json', 'pdf']),
});

function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * GET /api/notebook/export?threadId=xxx&format=txt|json|pdf
 * Export completed translation in various formats
 */
export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (...a: any[]) => console.log("[/api/notebook/export]", requestId, ...a);

  try {
    // 1) Parse query params
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get("threadId");
    const format = searchParams.get("format");

    let params: z.infer<typeof QuerySchema>;
    try {
      params = QuerySchema.parse({ threadId, format });
      log("query ok", { threadId: params.threadId, format: params.format });
    } catch (e: any) {
      log("bad query", e?.message);
      return err(400, "BAD_QUERY", "Invalid query params", { details: String(e?.message ?? e) });
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
      .select("id,created_by,state,created_at")
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

    // 4) Extract data
    const state = (thread.state as any) || {};
    const poemAnalysis = state.poem_analysis || {};
    const guideAnswers = state.guide_answers || {};
    const sourceLines = poemAnalysis.source_lines || [];
    const workshopLines = state.workshop_lines || [];
    const notebookCells = state.notebook_cells || {};

    // 5) Build cells data
    const cells = sourceLines.map((sourceLine: any, index: number) => {
      const workshopLine = workshopLines[index];
      const cellData = notebookCells[index] || {};

      return {
        lineIndex: index,
        source: sourceLine?.text || sourceLine,
        translation: cellData.translation?.text || workshopLine?.text || '',
        notes: cellData.notes || [],
        footnotes: cellData.footnotes || [],
        status: cellData.translation?.status || (workshopLine?.text ? 'draft' : 'untranslated'),
      };
    });

    // 6) Generate export based on format
    if (params.format === 'pdf') {
      log("pdf_not_implemented");
      return err(501, "NOT_IMPLEMENTED", "PDF export not yet implemented.");
    }

    if (params.format === 'json') {
      // Full JSON export with all metadata
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          threadId: thread.id,
          createdAt: thread.created_at,
          sourceLanguage: poemAnalysis.language || 'unknown',
          targetLanguage: guideAnswers.targetLanguage?.lang || 'unknown',
          dialect: poemAnalysis.dialect || guideAnswers.targetLanguage?.variety || null,
          totalLines: cells.length,
        },
        cells: cells.map((cell: any) => ({
          lineIndex: cell.lineIndex,
          source: cell.source,
          translation: cell.translation,
          notes: cell.notes,
          footnotes: cell.footnotes,
          status: cell.status,
        })),
        translatorPreferences: guideAnswers,
      };

      log("success", { format: 'json', cells: cells.length });
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="translation-${thread.id}.json"`,
        },
      });
    }

    if (params.format === 'txt') {
      // Plain text format
      const lines: string[] = [];

      // Header
      lines.push('='.repeat(60));
      lines.push('TRANSLATION EXPORT');
      lines.push('='.repeat(60));
      lines.push('');
      lines.push(`Exported: ${new Date().toISOString()}`);
      lines.push(`Source Language: ${poemAnalysis.language || 'unknown'}`);
      lines.push(`Target Language: ${guideAnswers.targetLanguage?.lang || 'unknown'}`);
      if (guideAnswers.targetLanguage?.variety) {
        lines.push(`Dialect/Variety: ${guideAnswers.targetLanguage.variety}`);
      }
      lines.push('');
      lines.push('='.repeat(60));
      lines.push('');

      // Original poem
      lines.push('ORIGINAL:');
      lines.push('');
      cells.forEach((cell: any) => {
        lines.push(cell.source);
      });
      lines.push('');
      lines.push('-'.repeat(60));
      lines.push('');

      // Translation
      lines.push('TRANSLATION:');
      lines.push('');
      cells.forEach((cell: any) => {
        lines.push(cell.translation || '[untranslated]');
      });
      lines.push('');

      // Notes (if any)
      const cellsWithNotes = cells.filter((c: any) => c.notes.length > 0 || c.footnotes.length > 0);
      if (cellsWithNotes.length > 0) {
        lines.push('-'.repeat(60));
        lines.push('');
        lines.push('NOTES:');
        lines.push('');
        cellsWithNotes.forEach((cell: any) => {
          lines.push(`Line ${cell.lineIndex + 1}:`);
          if (cell.notes.length > 0) {
            cell.notes.forEach((note: string) => {
              lines.push(`  - ${note}`);
            });
          }
          if (cell.footnotes.length > 0) {
            cell.footnotes.forEach((fn: any) => {
              lines.push(`  * "${fn.word}": ${fn.note}`);
            });
          }
          lines.push('');
        });
      }

      // Footer
      lines.push('='.repeat(60));
      lines.push(`Generated by Translalia (Thread: ${thread.id})`);
      lines.push('='.repeat(60));

      const textContent = lines.join('\n');

      log("success", { format: 'txt', cells: cells.length });
      return new NextResponse(textContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="translation-${thread.id}.txt"`,
        },
      });
    }

    // Should not reach here due to zod validation
    return err(400, "INVALID_FORMAT", "Invalid export format.");
  } catch (e: any) {
    console.error("[/api/notebook/export] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
