import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { z } from "zod";
import { WorkshopLineWithVerification } from "@/types/verification";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  originalLine: z.string(),
  translatedLine: z.string(),
});

/**
 * POST /api/workshop/save-manual-line
 *
 * Saves a manually created translation (from Notebook or Translation Studio)
 * that doesn't have workshop variants/selections.
 */
export async function POST(req: Request) {
  // Auth check
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    // Parse and validate request
    const body = await req.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { threadId, lineIndex, originalLine, translatedLine } =
      validation.data;

    // Verify thread ownership
    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state, project_id")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { error: "Thread not found or unauthorized" },
        { status: 404 }
      );
    }

    // Get current state
    const currentState = (thread.state as Record<string, unknown>) || {};

    // Create new line entry for manual translation
    const newLine: WorkshopLineWithVerification = {
      original: originalLine,
      translated: translatedLine,
      selections: [], // No word-level selections for manual translations
      completedAt: new Date().toISOString(),
      word_options: [], // No word options for manual translations
      verification: {
        trackA: {
          graded: false,
          gradedAt: "",
          auditId: "",
        },
        trackB: {
          contextGenerated: false,
          notes: [],
        },
      },
    };

    // Update workshop_lines in state as ARRAY
    let updatedWorkshopLinesArr: Array<WorkshopLineWithVerification | null> =
      [];
    if (Array.isArray(currentState.workshop_lines)) {
      updatedWorkshopLinesArr = [
        ...(currentState.workshop_lines as Array<WorkshopLineWithVerification | null>),
      ];
    } else if (
      currentState.workshop_lines &&
      typeof currentState.workshop_lines === "object"
    ) {
      // Convert object to array for backward compatibility
      const obj = currentState.workshop_lines as Record<string, unknown>;
      const keys = Object.keys(obj);
      const maxIndex =
        keys.length > 0 ? Math.max(...keys.map((k) => Number(k))) : -1;
      updatedWorkshopLinesArr = Array(maxIndex + 1)
        .fill(null)
        .map(
          (_, i) =>
            (obj[String(i)] as WorkshopLineWithVerification | null) || null
        );
      console.log("[save-manual-line] Converted workshop_lines from object to array");
    } else {
      updatedWorkshopLinesArr = [];
    }

    // Ensure array is large enough
    while (updatedWorkshopLinesArr.length <= lineIndex) {
      updatedWorkshopLinesArr.push(null);
    }

    // Set the line at the correct index
    updatedWorkshopLinesArr[lineIndex] = newLine;

    // Save to database
    const { error: updateError } = await supabase
      .from("chat_threads")
      .update({
        state: {
          ...currentState,
          workshop_lines: updatedWorkshopLinesArr,
        },
      })
      .eq("id", threadId);

    if (updateError) {
      console.error("[save-manual-line] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save line" },
        { status: 500 }
      );
    }

    console.log(
      `[save-manual-line] ✓ Saved manual translation for line ${lineIndex}`
    );

    return NextResponse.json({
      ok: true,
      translatedLine,
      lineIndex,
    });
  } catch (error) {
    console.error("[save-manual-line] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
