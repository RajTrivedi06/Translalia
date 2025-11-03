import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { z } from "zod";

const SelectionSchema = z.object({
  position: z.number().int().min(0),
  selectedWord: z.string().min(1),
});

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  originalLine: z.string().optional(),
  selections: z.array(SelectionSchema), // Allow empty array for blank lines
});

export interface WorkshopLine {
  original: string;
  translated: string;
  selections: Array<{
    position: number;
    selectedWord: string;
  }>;
  completedAt: string;
}

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

    const { threadId, lineIndex, originalLine, selections } = validation.data;

    // Verify thread ownership
    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { error: "Thread not found or unauthorized" },
        { status: 404 }
      );
    }

    // Sort selections by position
    const sortedSelections = [...selections].sort((a, b) => a.position - b.position);

    // Compile selected words into complete line
    const translatedLine = sortedSelections
      .map((s) => s.selectedWord)
      .join(" ");

    // Get current state
    const currentState = (thread.state as any) || {};
    const workshopLines = (currentState.workshop_lines as Record<
      number,
      WorkshopLine
    >) || {};

    // Create new line entry
    const newLine: WorkshopLine = {
      original: originalLine || "",
      translated: translatedLine,
      selections: sortedSelections,
      completedAt: new Date().toISOString(),
    };

    // Update workshop_lines in state
    const updatedWorkshopLines = {
      ...workshopLines,
      [lineIndex]: newLine,
    };

    // Save to database
    const { error: updateError } = await supabase
      .from("chat_threads")
      .update({
        state: {
          ...currentState,
          workshop_lines: updatedWorkshopLines,
        },
      })
      .eq("id", threadId);

    if (updateError) {
      console.error("[save-line] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save line" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      translatedLine,
      lineIndex,
    });
  } catch (error) {
    console.error("[save-line] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
