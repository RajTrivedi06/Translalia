import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import { z } from "zod";
import {
  WorkshopLineWithVerification,
  WordOptionForVerification,
} from "@/types/verification";
import type { LineTranslationResponse } from "@/types/lineTranslation";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  originalLine: z.string().optional(),
  // New format: line translation with variant
  variant: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  lineTranslation: z.unknown(), // validated at runtime
});

export type WorkshopLine = WorkshopLineWithVerification;

function normalizeLineTranslationResponse(
  input: unknown
): LineTranslationResponse | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<LineTranslationResponse>;
  if (!Array.isArray(candidate.translations)) return null;
  if (typeof candidate.lineOriginal !== "string") return null;
  if (typeof candidate.modelUsed !== "string") return null;
  return candidate as LineTranslationResponse;
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

    const { threadId, lineIndex, originalLine, variant, lineTranslation } =
      validation.data;

    const parsedLineTranslation =
      normalizeLineTranslationResponse(lineTranslation);
    if (!parsedLineTranslation) {
      return NextResponse.json(
        { error: "Invalid lineTranslation payload" },
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

    // Determine translated line from selected variant
    const selectedVariant = parsedLineTranslation.translations.find(
      (v) => v.variant === variant
    );
    if (!selectedVariant) {
      return NextResponse.json(
        { error: "Invalid variant number" },
        { status: 400 }
      );
    }

    const translatedLine = selectedVariant.fullText;

    // Build verification-friendly selections + options from line variants
    const selectionsForVerification = selectedVariant.words.map((w) => ({
      source: w.original,
      target: w.translation,
      order: w.position,
    }));

    const wordOptionsForVerification: WordOptionForVerification[] =
      selectedVariant.words.map((w) => {
        const options = parsedLineTranslation.translations
          .map(
            (variantEntry) =>
              variantEntry.words.find((vw) => vw.position === w.position)
                ?.translation
          )
          .filter(
            (t): t is string => typeof t === "string" && t.trim().length > 0
          );

        const unique = Array.from(new Set(options));
        return {
          source: w.original,
          order: w.position,
          options: unique.length > 0 ? unique : [w.translation],
          pos: w.partOfSpeech,
        };
      });

    // Get current state
    const currentState = (thread.state as Record<string, unknown>) || {};

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

    // ✅ LOG: State write activity (before write)
    const translationJob = currentState.translation_job as { version?: number; chunks?: Record<number, { lines?: unknown[] }>; active?: number[]; queue?: number[] } | undefined;
    const jobVersion = translationJob?.version ?? "none";
    const chunks = translationJob?.chunks || {};
    const chunk0Lines = chunks[0]?.lines?.length ?? "none";
    const chunk1Lines = chunks[1]?.lines?.length ?? "none";
    const activeIndices = translationJob?.active || [];
    const queueLength = translationJob?.queue?.length ?? "none";
    const activeLength = activeIndices.length;
    const activeDisplay = activeLength > 0 ? `[${activeIndices.join(",")}]` : "[]";
    const writingVersion = translationJob?.version ?? "none";
    const prevSeenVersion = translationJob?.version ?? "none"; // Same as what we read
    
    console.log(
      `[STATE_WRITE] writer=save-line threadId=${threadId} jobVersion=${jobVersion} ` +
      `chunks[0].lines=${chunk0Lines} chunks[1].lines=${chunk1Lines} ` +
      `queue.length=${queueLength} active=${activeDisplay} updating=workshop_lines ` +
      `versionCheck=no prevSeenVersion=${prevSeenVersion} writingVersion=${writingVersion}`
    );

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

      const verificationUrl = `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      }/api/verification/grade-line`;
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
