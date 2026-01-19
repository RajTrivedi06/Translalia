/**
 * POST /api/workshop/retry-line
 * Retry a single failed line within a stanza
 *
 * Allows users to retry individual failed lines instead of entire chunks.
 * More granular than retry-stanza - useful when most lines succeeded.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/requireUser";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  getTranslationJob,
  updateStanzaStatus,
} from "@/lib/workshop/jobState";
import { translateLineInternal } from "@/lib/workshop/translateLineInternal";
import { translateLineWithRecipesInternal } from "@/lib/translation/method2/translateLineWithRecipesInternal";
import type { GuideAnswers } from "@/store/guideSlice";
import type { StanzaDetectionResult } from "@/lib/poem/stanzaDetection";
import type { LineQualityMetadata } from "@/types/translationJob";

const RequestSchema = z.object({
  threadId: z.string().uuid(),
  stanzaIndex: z.number().int().min(0),
  lineNumber: z.number().int().min(0),
});

interface ErrorResponse {
  error: string;
  details?: unknown;
}

interface SuccessResponse {
  success: boolean;
  line: {
    line_number: number;
    status: string;
    translations?: unknown[];
  };
  stanza: {
    index: number;
    status: string;
  };
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validation.error.issues,
        } as ErrorResponse,
        { status: 400 }
      );
    }

    const { threadId, stanzaIndex, lineNumber } = validation.data;

    // Verify thread ownership and load context
    const supabase = await supabaseServer();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, state, created_by, project_id")
      .eq("id", threadId)
      .eq("created_by", user.id)
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { error: "Thread not found or unauthorized" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Get thread context
    const state = (thread.state as Record<string, unknown>) || {};
    const guideAnswers = (state.guide_answers as GuideAnswers) || {};
    const stanzaResult = state.poem_stanzas as
      | StanzaDetectionResult
      | undefined;
    const rawPoem = (state.raw_poem as string) || "";
    const poemAnalysis = (state.poem_analysis as { language?: string }) || {};
    const sourceLanguage = poemAnalysis.language || "the source language";

    if (!stanzaResult?.stanzas || stanzaResult.stanzas.length === 0) {
      return NextResponse.json(
        { error: "Poem stanzas missing" } as ErrorResponse,
        { status: 400 }
      );
    }

    if (!rawPoem) {
      return NextResponse.json(
        { error: "Raw poem text missing" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Get current job
    const job = await getTranslationJob(threadId);
    if (!job) {
      return NextResponse.json(
        { error: "Translation job not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Validate stanza index
    const chunksOrStanzas = job.chunks || job.stanzas || {};
    if (stanzaIndex < 0 || stanzaIndex >= Object.keys(chunksOrStanzas).length) {
      return NextResponse.json(
        { error: "Invalid stanza index" } as ErrorResponse,
        { status: 400 }
      );
    }

    const chunk = chunksOrStanzas[stanzaIndex];
    if (!chunk) {
      return NextResponse.json(
        { error: "Stanza not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Find the line in the chunk
    const lines = chunk.lines || [];
    let lineIndex = -1;

    // ✅ CRITICAL FIX: If chunk.lines is missing (known bug), allow retry anyway
    // The line clearly exists if user can see it in UI and click retry
    // Backend will regenerate the line and rebuild the lines array
    if (lines.length === 0) {
      console.warn(
        `[retry-line] Chunk ${stanzaIndex} missing lines array - allowing retry anyway (lines array persistence bug)`
      );
      // lineIndex stays -1, will rebuild lines array below
    } else {
      lineIndex = lines.findIndex((l) => l.line_number === lineNumber);

      if (lineIndex === -1) {
        // Line not found in array - could be the same persistence bug
        // Log the issue and allow retry to proceed
        console.warn(
          `[retry-line] Line ${lineNumber} not found in chunk ${stanzaIndex} lines array (length: ${lines.length}). Allowing retry to rebuild.`
        );
        // Don't return error - proceed with retry to fix the state
      } else {
        const line = lines[lineIndex];

        // Check if line needs retry (only block if it's actually successfully translated)
        if (
          line.translationStatus === "translated" &&
          line.translations &&
          line.translations.length === 3 &&
          !line.translations.some((t) => !t.fullText || t.fullText.trim() === "")
        ) {
          return NextResponse.json(
            { error: "Line is already successfully translated" } as ErrorResponse,
            { status: 400 }
          );
        }
      }
    }

    // Get stanza and line context
    const stanza = stanzaResult.stanzas[stanzaIndex];
    if (!stanza) {
      return NextResponse.json(
        { error: "Stanza not found in poem" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Calculate global line offset
    let lineOffset = 0;
    for (let i = 0; i < stanzaIndex; i++) {
      lineOffset += stanzaResult.stanzas[i].lines.length;
    }

    const flattenedLines = stanzaResult.stanzas.flatMap((s) => s.lines);
    const localLineIndex = lineNumber - lineOffset;
    const lineText = stanza.lines[localLineIndex];

    if (!lineText) {
      return NextResponse.json(
        { error: "Line text not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    const prevLine = lineNumber > 0 ? flattenedLines[lineNumber - 1] : undefined;
    const nextLine =
      lineNumber < flattenedLines.length - 1
        ? flattenedLines[lineNumber + 1]
        : undefined;

    // Prepare translation parameters
    const targetLang = guideAnswers.targetLanguage?.lang?.trim();
    const targetVariety = guideAnswers.targetLanguage?.variety?.trim();
    const targetLanguage = targetLang
      ? `${targetLang}${targetVariety ? ` (${targetVariety})` : ""}`
      : "the target language";
    const selectedModel = guideAnswers.translationModel;
    const translationMethod = guideAnswers.translationMethod ?? "method-2";

    console.log(
      `[retry-line] Retrying line ${lineNumber} in stanza ${stanzaIndex} using ${translationMethod}`
    );

    // Retry the translation
    let lineTranslation;
    try {
      if (translationMethod === "method-2") {
        lineTranslation = await translateLineWithRecipesInternal({
          threadId,
          lineIndex: lineNumber,
          lineText,
          fullPoem: rawPoem,
          stanzaIndex,
          prevLine,
          nextLine,
          guideAnswers,
          sourceLanguage,
          targetLanguage,
          model: selectedModel,
          auditUserId: user.id,
          auditProjectId: thread.project_id ?? null,
        });
      } else {
        lineTranslation = await translateLineInternal({
          threadId,
          lineIndex: lineNumber,
          lineText,
          fullPoem: rawPoem,
          stanzaIndex,
          prevLine,
          nextLine,
          guideAnswers,
          sourceLanguage,
          targetLanguage,
          modelOverride: selectedModel,
          audit: {
            createdBy: user.id,
            projectId: thread.project_id ?? null,
            stage: "workshop-retry-line",
          },
        });
      }
    } catch (error) {
      console.error(`[retry-line] Translation failed:`, error);
      return NextResponse.json(
        {
          error: "Translation failed",
          details: error instanceof Error ? error.message : undefined,
        } as ErrorResponse,
        { status: 500 }
      );
    }

    // Update the line in the chunk
    const updatedLine = {
      line_number: lineNumber,
      original_text: lineText,
      translations: lineTranslation.translations,
      model_used: lineTranslation.modelUsed,
      updated_at: Date.now(),
      translationStatus: "translated" as const,
      alignmentStatus: "skipped" as const,
      quality_metadata:
        translationMethod === "method-2" && "qualityMetadata" in lineTranslation
          ? (lineTranslation as { qualityMetadata?: LineQualityMetadata }).qualityMetadata
          : undefined,
      retry_count: lineIndex >= 0 ? ((lines[lineIndex]?.retry_count ?? 0) + 1) : 1, // Track retries
    };

    // ✅ FIX: Handle all cases - updating existing line, rebuilding array, or merging
    let updatedLines: typeof chunk.lines;
    if (lineIndex >= 0 && lines.length > 0) {
      // Normal case: update existing line in array
      updatedLines = [...lines];
      updatedLines[lineIndex] = updatedLine;
      console.log(
        `[retry-line] Updated line ${lineNumber} at index ${lineIndex} in chunk ${stanzaIndex}`
      );
    } else if (lines.length === 0) {
      // Fallback case: lines array was empty, need to reconstruct it
      // Try to find other lines for this stanza from the stanza structure
      console.warn(
        `[retry-line] Rebuilding lines array for chunk ${stanzaIndex} - lines array was empty`
      );

      // Calculate where this line should be in the array based on stanza structure
      let reconstructedLines: typeof chunk.lines = [];
      const stanzaLineCount = stanza.lines.length;

      // Build array with placeholders for all lines in the stanza
      for (let i = 0; i < stanzaLineCount; i++) {
        const globalLineNum = lineOffset + i;
        if (globalLineNum === lineNumber) {
          reconstructedLines.push(updatedLine);
        } else {
          // Placeholder for other lines - they may be processed later
          reconstructedLines.push({
            line_number: globalLineNum,
            original_text: stanza.lines[i],
            translations: [],
            translationStatus: "pending" as const,
            alignmentStatus: "skipped" as const,
            updated_at: Date.now(),
          });
        }
      }
      updatedLines = reconstructedLines;
      console.log(
        `[retry-line] Reconstructed lines array with ${updatedLines.length} lines for chunk ${stanzaIndex}`
      );
    } else {
      // Edge case: lines array exists but line not found - append it
      console.warn(
        `[retry-line] Line ${lineNumber} not found in existing array, appending to chunk ${stanzaIndex}`
      );
      updatedLines = [...lines, updatedLine];
    }

    // Check if all lines in stanza are now translated
    const allLinesTranslated = updatedLines.every(
      (l) => l.translationStatus === "translated"
    );

    // Update stanza status
    const newStanzaStatus = allLinesTranslated ? "completed" : chunk.status;

    await updateStanzaStatus(threadId, stanzaIndex, {
      lines: updatedLines,
      status: newStanzaStatus,
      linesProcessed: updatedLines.filter(
        (l) => l.translationStatus === "translated"
      ).length,
      error: allLinesTranslated ? undefined : chunk.error,
    });

    console.log(
      `[retry-line] Successfully retried line ${lineNumber}, stanza status: ${newStanzaStatus}`
    );

    return NextResponse.json(
      {
        success: true,
        line: {
          line_number: lineNumber,
          status: "translated",
          translations: lineTranslation.translations,
        },
        stanza: {
          index: stanzaIndex,
          status: newStanzaStatus,
        },
      } as SuccessResponse,
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[retry-line] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : undefined,
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
