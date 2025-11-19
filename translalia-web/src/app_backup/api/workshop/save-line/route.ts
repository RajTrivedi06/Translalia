import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { z } from "zod";
import {
  WorkshopLineWithVerification,
  WordOptionForVerification,
} from "@/types/verification";
import type { LineTranslationResponse } from "@/types/lineTranslation";

const SelectionSchema = z.object({
  position: z.number().int().min(0),
  selectedWord: z.string().min(1),
});

const WordOptionSchema = z.object({
  original: z.string(),
  position: z.number(),
  options: z.array(z.string()).min(1),
  partOfSpeech: z.string().optional(),
});

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  originalLine: z.string().optional(),
  // New format: line translation with variant
  variant: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  lineTranslation: z.any().optional(), // LineTranslationResponse - using any for now to avoid circular deps
  // Old format: word selections (for backward compatibility)
  selections: z.array(SelectionSchema).optional(), // Allow empty array for blank lines
  wordOptions: z.array(WordOptionSchema).optional(), // Optional: word options for verification
});

// Legacy interface for backwards compatibility
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

    const {
      threadId,
      lineIndex,
      originalLine,
      variant,
      lineTranslation,
      selections,
      wordOptions,
    } = validation.data;

    // Validate that either new format or old format is provided
    const hasNewFormat = variant !== undefined && lineTranslation !== undefined;
    const hasOldFormat = selections !== undefined && selections.length > 0;

    if (!hasNewFormat && !hasOldFormat) {
      return NextResponse.json(
        {
          error:
            "Either variant+lineTranslation or selections must be provided",
        },
        { status: 400 }
      );
    }

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

    // Determine translated line and selections based on format
    let translatedLine: string;
    let finalSelections: Array<{ position: number; selectedWord: string }>;
    let finalWordOptions: WordOptionForVerification[] | undefined;

    if (hasNewFormat && variant && lineTranslation) {
      // New format: use selected variant's fullText
      const selectedVariant = (
        lineTranslation as LineTranslationResponse
      ).translations.find((v) => v.variant === variant);
      if (!selectedVariant) {
        return NextResponse.json(
          { error: "Invalid variant number" },
          { status: 400 }
        );
      }
      translatedLine = selectedVariant.fullText;

      // Convert alignment words to selections format for compatibility
      finalSelections = selectedVariant.words.map((word) => ({
        position: word.position,
        selectedWord: word.translation,
      }));

      // Convert alignment words to word options format for verification
      finalWordOptions = selectedVariant.words.map((word) => ({
        source: word.original,
        order: word.position,
        options: [word.translation], // Single option from selected variant
        pos: word.partOfSpeech,
      }));
    } else if (hasOldFormat && selections) {
      // Old format: compile from word selections
      const sortedSelections = [...selections].sort(
        (a, b) => a.position - b.position
      );
      translatedLine = sortedSelections.map((s) => s.selectedWord).join(" ");
      finalSelections = sortedSelections;

      // Transform word options to verification format if provided
      if (wordOptions && wordOptions.length > 0) {
        finalWordOptions = wordOptions.map(
          (wo: z.infer<typeof WordOptionSchema>) => ({
            source: wo.original,
            order: wo.position,
            options: wo.options,
            pos: wo.partOfSpeech,
          })
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }

    // Get current state
    const currentState = (thread.state as Record<string, unknown>) || {};

    // Use finalWordOptions (already transformed above)
    const wordOptionsForVerification = finalWordOptions;

    // Transform selections to verification format (source -> target mapping)
    const selectionsForVerification = finalSelections.map(
      (sel: { position: number; selectedWord: string }) => {
        // Find the corresponding word option to get the source word
        const wordOption = wordOptions?.find(
          (wo: z.infer<typeof WordOptionSchema>) => wo.position === sel.position
        );
        return {
          source: wordOption?.original || sel.selectedWord, // Fallback to selected word if no option found
          target: sel.selectedWord,
          order: sel.position,
        };
      }
    );

    // Create new line entry with verification support
    const newLine: WorkshopLineWithVerification = {
      original: originalLine || "",
      translated: translatedLine,
      selections: selectionsForVerification,
      completedAt: new Date().toISOString(),
      // Store word options for verification if available
      word_options: wordOptionsForVerification,
      // Initialize verification structure
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

    // Update workshop_lines in state as ARRAY (with backward-compatible conversion)
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
      console.log("[save-line] Converted workshop_lines from object to array");
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
      console.error("[save-line] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save line" },
        { status: 500 }
      );
    }

    // ============ VERIFICATION TRIGGER (Phase 2) ============
    // Trigger async verification if feature flag enabled
    if (process.env.NEXT_PUBLIC_FEATURE_VERIFICATION_INTERNAL === "true") {
      console.log("[save-line] DEBUG: Feature flag is enabled");
      console.log(
        "[save-line] DEBUG: About to trigger verification for line",
        lineIndex
      );

      const verificationUrl = `$${"{"}${"process"}.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}$${"}"}/api/verification/grade-line`;
      console.log("[save-line] DEBUG: Verification URL:", verificationUrl);

      // Fire and forget with comprehensive error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      fetch(verificationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(req.headers.get("authorization") && {
            Authorization: req.headers.get("authorization")!,
          }),
        },
        body: JSON.stringify({
          threadId,
          lineIndex,
        }),
        signal: controller.signal,
      })
        .then((response) => {
          clearTimeout(timeoutId);
          if (!response.ok) {
            console.warn(
              "[save-line] Verification returned non-200:",
              response.status,
              response.statusText
            );
            return response
              .json()
              .then((data) => {
                console.warn("[save-line] Verification error details:", data);
              })
              .catch(() => undefined);
          } else {
            console.log(
              "[save-line] ✓ Verification triggered successfully for line",
              lineIndex
            );
          }
        })
        .catch((err: unknown) => {
          clearTimeout(timeoutId);
          // Log but don't fail - verification is non-critical
          const e = err as { name?: string; message?: string };
          if (e?.name === "AbortError") {
            console.warn(
              "[save-line] Verification timeout (non-critical):",
              lineIndex
            );
          } else if (
            e?.name === "TypeError" &&
            (e?.message || "").includes("fetch")
          ) {
            console.warn(
              "[save-line] Network error triggering verification (non-critical)"
            );
          } else {
            console.warn(
              "[save-line] Verification trigger failed (non-critical):",
              e?.message || "unknown error"
            );
          }
        });

      console.log(
        "[save-line] Triggered background verification for line",
        lineIndex
      );
    } else {
      console.log("[save-line] DEBUG: Verification feature flag is OFF");
    }
    // ============ END VERIFICATION TRIGGER ============

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
