import type { Stanza } from "@/lib/poem/stanzaDetection";
import type { GuideAnswers } from "@/store/guideSlice";
import type { TranslatedLine, ErrorCode } from "@/types/translationJob";

import { translateLineInternal } from "@/lib/workshop/translateLineInternal";
import { translateLineWithRecipesInternal } from "@/lib/translation/method2/translateLineWithRecipesInternal";
import { updateStanzaStatus } from "@/lib/workshop/jobState";

/**
 * Classify an error as retryable or permanent
 */
function classifyError(error: unknown): {
  code: ErrorCode;
  retryable: boolean;
  message: string;
} {
  if (!(error instanceof Error)) {
    return {
      code: "unknown",
      retryable: true,
      message: "Unknown error occurred",
    };
  }

  const msg = error.message.toLowerCase();

  // Timeout errors are retryable
  if (msg.includes("timeout") || msg.includes("abort")) {
    return {
      code: "timeout",
      retryable: true,
      message: "Request timeout - service may be temporarily overloaded",
    };
  }

  // Rate limit errors are retryable
  if (msg.includes("rate") || msg.includes("429")) {
    return {
      code: "rate_limit",
      retryable: true,
      message: "Rate limit exceeded - will retry after delay",
    };
  }

  // Server errors are retryable
  if (msg.includes("500") || msg.includes("502") || msg.includes("503")) {
    return {
      code: "server_error",
      retryable: true,
      message: "Server error - will retry",
    };
  }

  // Model not found is non-retryable (config error, not transient)
  // Note: translateLineInternal already has model fallback logic (gpt-4o → gpt-4o-mini)
  // If it reaches here, both fallbacks failed - this is a configuration problem
  if (msg.includes("model_not_found") || msg.includes("404")) {
    return {
      code: "model_not_found",
      retryable: false,
      message:
        "Model not available (configuration issue) - check API keys and model availability",
    };
  }

  // Validation errors are permanent
  if (msg.includes("validation") || msg.includes("invalid")) {
    return {
      code: "validation_error",
      retryable: false,
      message: "Invalid request format - check poem content",
    };
  }

  // Auth errors are permanent
  if (msg.includes("auth") || msg.includes("401") || msg.includes("403")) {
    return {
      code: "auth_error",
      retryable: false,
      message: "Authentication failed - check configuration",
    };
  }

  // Default: assume retryable for unknown errors
  return {
    code: "unknown",
    retryable: true,
    message: error.message,
  };
}

export interface ProcessStanzaParams {
  threadId: string;
  stanzaIndex: number;
  stanza: Stanza;
  lineOffset: number;
  flattenedLines: string[];
  rawPoem: string;
  guideAnswers: GuideAnswers;
  sourceLanguage: string;
  auditUserId?: string;
  auditProjectId?: string | null;
}

/**
 * Calculate exponential backoff delay in milliseconds
 * Formula: baseDelay * (2 ^ retryCount), capped at maxDelay
 */
function calculateBackoffDelay(retryCount: number): number {
  const baseDelay = 2000; // 2 seconds
  const maxDelay = 30000; // 30 seconds
  const delay = baseDelay * Math.pow(2, retryCount);
  return Math.min(delay, maxDelay);
}

export async function processStanza({
  threadId,
  stanzaIndex,
  stanza,
  lineOffset,
  flattenedLines,
  rawPoem,
  guideAnswers,
  sourceLanguage,
  auditUserId,
  auditProjectId,
}: ProcessStanzaParams): Promise<void> {
  const totalLines = stanza.lines.length;
  const translatedLines: TranslatedLine[] = [];
  const targetLang = guideAnswers.targetLanguage?.lang?.trim();
  const targetVariety = guideAnswers.targetLanguage?.variety?.trim();
  const targetLanguage = targetLang
    ? `${targetLang}${targetVariety ? ` (${targetVariety})` : ""}`
    : "the target language";

  console.log(
    `[processStanza] Starting stanza ${stanzaIndex} with ${totalLines} lines`
  );

  for (let i = 0; i < totalLines; i += 1) {
    const lineText = stanza.lines[i];
    const globalLineIndex = lineOffset + i;

    const prevLine =
      globalLineIndex > 0 ? flattenedLines[globalLineIndex - 1] : undefined;
    const nextLine =
      globalLineIndex < flattenedLines.length - 1
        ? flattenedLines[globalLineIndex + 1]
        : undefined;

    if (!lineText?.trim()) {
      // ✅ DEFENSIVE: Record empty line with proper status markers
      const emptyLine = {
        line_number: globalLineIndex,
        original_text: lineText || "",
        translations: [],
        updated_at: Date.now(),
        translationStatus: "translated" as const, // ✅ Mark empty lines as translated
        alignmentStatus: "skipped" as const, // ✅ Empty lines don't need alignment
      };
      translatedLines.push(emptyLine);

      console.log(
        `[processStanza] Empty line ${globalLineIndex} in stanza ${stanzaIndex} - marked as translated`
      );

      // ✅ CRITICAL: Use try-catch to ensure empty lines are always recorded
      try {
        await updateStanzaStatus(threadId, stanzaIndex, {
          linesProcessed: i + 1,
          lastLineTranslated: globalLineIndex,
          // Store the empty line with proper status
          lines: translatedLines,
        });
      } catch (error) {
        console.error(
          `[processStanza] Failed to update empty line ${globalLineIndex}:`,
          error
        );
        // Don't throw - continue processing other lines
        // The empty line is still in translatedLines array
      }
      continue;
    }

    // Translate the line with error handling (Feature 9)
    // Use user-selected model from guideAnswers (not env default)
    const selectedModel = guideAnswers.translationModel;

    // Determine translation method (default to method-2)
    const translationMethod = guideAnswers.translationMethod ?? "method-2";
    console.log("[BG] translationMethod =", translationMethod);

    try {
      let lineTranslation;

      if (translationMethod === "method-2") {
        // Method 2: Recipe-driven prismatic variants
        lineTranslation = await translateLineWithRecipesInternal({
          threadId,
          lineIndex: globalLineIndex,
          lineText,
          fullPoem: rawPoem,
          stanzaIndex,
          prevLine,
          nextLine,
          guideAnswers,
          sourceLanguage,
          targetLanguage,
          model: selectedModel,
          auditUserId,
          auditProjectId,
        });
      } else {
        // Method 1: Traditional translation
        lineTranslation = await translateLineInternal({
          threadId,
          lineIndex: globalLineIndex,
          lineText,
          fullPoem: rawPoem,
          stanzaIndex,
          prevLine,
          nextLine,
          guideAnswers,
          sourceLanguage,
          targetLanguage,
          modelOverride: selectedModel, // ← Use user-selected model for background translations
          audit:
            auditUserId !== undefined
              ? {
                  createdBy: auditUserId,
                  projectId: auditProjectId ?? null,
                  stage: "workshop-background-translate-line",
                }
              : undefined,
        });
      }

      // Store translated line with full results (Feature 8)
      // Translation is complete after main-gen + gate (+ regen) - mark as "translated" immediately
      const lineData: (typeof translatedLines)[0] = {
        line_number: globalLineIndex,
        original_text: lineText,
        translations: lineTranslation.translations,
        model_used: lineTranslation.modelUsed,
        updated_at: Date.now(),
        translationStatus: "translated", // Translation is complete - show immediately
      };

      // Add quality metadata and alignment status for Method 2
      if (
        translationMethod === "method-2" &&
        "qualityMetadata" in lineTranslation
      ) {
        const method2Response = lineTranslation as {
          qualityMetadata?: import("@/types/translationJob").LineQualityMetadata;
        };
        const qualityMetadata = method2Response.qualityMetadata;

        // Set translationStatus based on quality tier
        if (qualityMetadata?.quality_tier === "failed") {
          lineData.translationStatus = "failed"; // Hard failure
        } else {
          lineData.translationStatus = "translated"; // Pass or salvage - show immediately
        }

        // Alignment: optional for Method 2 (only if drag-and-drop UI is used)
        // For now, we'll skip alignment for Method 2 unless explicitly needed
        // Set to "skipped" - can be changed to "pending" if alignment is needed
        lineData.alignmentStatus = "skipped"; // Method 2 doesn't require alignment by default
        lineData.quality_metadata = qualityMetadata;
      } else {
        // ✅ CRITICAL FIX: Method 1 alignment worker doesn't exist
        // Marking as "pending" causes lines to stay incomplete forever
        // Mark as "skipped" until alignment worker is implemented
        lineData.translationStatus = "translated";
        lineData.alignmentStatus = "skipped"; // ✅ Changed from "pending" to "skipped"
        // TODO: Implement alignment worker or remove alignment requirement
        console.log(
          `[processStanza] Line ${globalLineIndex} (Method 1): alignment skipped (no worker available)`
        );
      }

      translatedLines.push(lineData);

      console.time(`[TIMING][line=${globalLineIndex}] db-write`);
      await updateStanzaStatus(threadId, stanzaIndex, {
        status: "processing",
        linesProcessed: i + 1,
        lastLineTranslated: globalLineIndex,
        // Feature 8: Store all translated lines so far
        lines: translatedLines,
      });
      console.timeEnd(`[TIMING][line=${globalLineIndex}] db-write`);
    } catch (error) {
      // Feature 9: Classify error and decide on retry/fallback
      const { code, retryable, message } = classifyError(error);
      const now = Date.now();

      // Add to error history
      const errorHistoryEntry = {
        timestamp: now,
        error: message,
        code,
        retryable,
      };

      // Determine retry action
      const stanzaState = await updateStanzaStatus(threadId, stanzaIndex, {
        error: message,
        error_details: {
          code,
          timestamp: now,
          retryable,
          message,
        },
        error_history: [errorHistoryEntry],
      });

      // If retryable and under max retries, re-queue with backoff (Feature 7)
      if (retryable && stanzaState) {
        const chunkOrStanzaStates =
          stanzaState.chunks || stanzaState.stanzas || {};
        const currentRetries = chunkOrStanzaStates[stanzaIndex]?.retries ?? 0;
        const maxRetries = chunkOrStanzaStates[stanzaIndex]?.maxRetries ?? 3;

        if (currentRetries < maxRetries) {
          // Calculate backoff delay and set nextRetryAt
          const backoffDelay = calculateBackoffDelay(currentRetries);
          const nextRetryAt = now + backoffDelay;

          // Re-queue stanza with updated retry count and backoff time
          await updateStanzaStatus(threadId, stanzaIndex, {
            retries: currentRetries + 1,
            status: "queued",
            nextRetryAt, // Feature 7: Store when backoff expires
          });
          console.warn(
            `[processStanza] Stanza ${stanzaIndex} error (${code}): retry ${
              currentRetries + 1
            }/${maxRetries} in ${(backoffDelay / 1000).toFixed(1)}s`
          );
          throw error; // Propagate to stop processing this stanza
        }
      }

      // ✅ CRITICAL FIX: Preserve successfully translated lines even on chunk failure
      // Permanent error or max retries exceeded: mark stanza as failed
      // But keep successfully translated lines as "translated"
      const updatedLines = translatedLines.map((line) => {
        // Keep already translated lines as translated
        if (line.translationStatus === "translated") {
          return line;
        }
        // Mark pending/undefined lines as failed
        return {
          ...line,
          translationStatus: "failed" as const,
        };
      });

      // ✅ Log which lines were saved vs failed
      const successfulLines = updatedLines.filter(
        (l) => l.translationStatus === "translated"
      ).length;
      const failedLines = updatedLines.filter(
        (l) => l.translationStatus === "failed"
      ).length;

      console.warn(
        `[processStanza] Stanza ${stanzaIndex} failed (${code}): ${successfulLines} lines saved, ${failedLines} lines failed`
      );

      await updateStanzaStatus(threadId, stanzaIndex, {
        status: "failed",
        retries:
          stanzaState?.chunks?.[stanzaIndex]?.retries ??
          stanzaState?.stanzas?.[stanzaIndex]?.retries ??
          0,
        lines: updatedLines,
      });

      console.error(
        `[processStanza] Stanza ${stanzaIndex} failed (${code}): ${message}`
      );
      throw error; // Propagate to stop processing this stanza
    }
  }

  // ✅ FINAL VALIDATION: Ensure all lines were processed
  console.log(
    `[processStanza] Finished stanza ${stanzaIndex}: processed ${translatedLines.length}/${totalLines} lines`
  );

  if (translatedLines.length !== totalLines) {
    console.error(
      `[processStanza] CRITICAL: Stanza ${stanzaIndex} missing lines! Expected ${totalLines}, got ${translatedLines.length}`
    );
    throw new Error(
      `Stanza processing incomplete: ${translatedLines.length}/${totalLines} lines processed`
    );
  }

  // Validate all lines have proper status
  const incompleteLines = translatedLines.filter(
    (line) =>
      !line.translationStatus || line.translationStatus === "pending"
  );

  if (incompleteLines.length > 0) {
    console.error(
      `[processStanza] CRITICAL: Stanza ${stanzaIndex} has ${incompleteLines.length} incomplete lines:`,
      incompleteLines.map((l) => ({
        line_number: l.line_number,
        status: l.translationStatus,
        text: l.original_text?.substring(0, 50),
      }))
    );
    throw new Error(
      `Stanza has ${incompleteLines.length} incomplete lines`
    );
  }

  console.log(
    `[processStanza] Stanza ${stanzaIndex} successfully completed with all lines properly processed`
  );
}
