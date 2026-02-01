import type { Stanza } from "@/lib/poem/stanzaDetection";
import type { GuideAnswers } from "@/store/guideSlice";
import type { TranslatedLine, ErrorCode } from "@/types/translationJob";

import { translateLineInternal } from "@/lib/workshop/translateLineInternal";
import { translateLineWithRecipesInternal } from "@/lib/translation/method2/translateLineWithRecipesInternal";
import { updateStanzaStatus, updateSingleLine, getTranslationJob } from "@/lib/workshop/jobState";
import { ConcurrencyLimiter } from "@/lib/workshop/concurrencyLimiter";

/**
 * Classify an error as retryable or permanent
 */
export function classifyError(error: unknown): {
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

import type { TickInstrumentation } from "./runTranslationTick";
import { createRetryTelemetryCollector } from "@/lib/telemetry/retryTelemetry";

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
  // ISS-005: Time budget for interruptible processing
  deadlineMs?: number; // Absolute deadline timestamp (Date.now() + budget)
  // ISS-016/017: Instrumentation for retry telemetry and OpenAI call tracking
  instrumentation?: TickInstrumentation;
}

/**
 * ISS-005: Budget helper for time-slicing
 */
class BudgetChecker {
  private deadline: number;

  constructor(deadlineMs: number) {
    this.deadline = deadlineMs;
  }

  shouldStop(): boolean {
    return Date.now() >= this.deadline;
  }

  remainingMs(): number {
    return Math.max(0, this.deadline - Date.now());
  }

  elapsedMs(startTime: number): number {
    return Date.now() - startTime;
  }
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

export interface ProcessStanzaResult {
  interrupted?: boolean;
  linesCompleted?: number;
  linesTotal?: number;
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
  deadlineMs,
  instrumentation,
}: ProcessStanzaParams): Promise<ProcessStanzaResult> {
  // ISS-005: Time-slicing support
  const timeSlicingEnabled = process.env.ENABLE_TICK_TIME_SLICING !== "0";
  const budget = deadlineMs
    ? new BudgetChecker(deadlineMs)
    : null;

  const totalLines = stanza.lines.length;
  const translatedLines: TranslatedLine[] = [];
  const targetLang = guideAnswers.targetLanguage?.lang?.trim();
  const targetVariety = guideAnswers.targetLanguage?.variety?.trim();
  const targetLanguage = targetLang
    ? `${targetLang}${targetVariety ? ` (${targetVariety})` : ""}`
    : "the target language";

  // ISS-005: Load existing lines to determine resumption point
  const job = await getTranslationJob(threadId);
  const chunkOrStanzaStates = job?.chunks || job?.stanzas || {};
  const existingStanza = chunkOrStanzaStates[stanzaIndex];
  const existingLines = existingStanza?.lines || [];
  
  // Build map of already-translated lines (for resumption)
  const translatedLineNumbers = new Set(
    existingLines
      .filter((line) => line.translationStatus === "translated" || line.translationStatus === "failed")
      .map((line) => line.line_number)
  );

  const pendingLineCount = totalLines - translatedLineNumbers.size;
  const resumePoint = existingLines.length > 0 ? `${translatedLineNumbers.size}/${totalLines} already translated` : "starting fresh";

  // ISS-003: Bounded parallel line processing
  const parallelEnabled = process.env.MAIN_GEN_PARALLEL_LINES !== "0";
  const rawLineConcurrency = process.env.MAIN_GEN_LINE_CONCURRENCY;
  const lineConcurrency = Math.min(
    Math.max(1, rawLineConcurrency ? parseInt(rawLineConcurrency, 10) : 6), // Default 6
    8, // Allow up to 8 for aggressive parallelism
  );

  console.log(
    `[processStanza] Line concurrency: ${lineConcurrency} (env=${rawLineConcurrency || "unset"})`,
  );
  console.log(
    `[processStanza] Starting stanza ${stanzaIndex} with ${totalLines} lines ` +
    `(parallel=${parallelEnabled}, concurrency=${lineConcurrency}, ` +
    `timeSlicing=${timeSlicingEnabled}, resume=${resumePoint}, ` +
    `budget=${budget ? `${budget.remainingMs()}ms` : "unlimited"})`
  );

  const stanzaStartTime = Date.now();
  const limiter = parallelEnabled
    ? new ConcurrencyLimiter(lineConcurrency)
    : new ConcurrencyLimiter(1); // Sequential mode = concurrency 1

  // ISS-005: Filter to only pending lines (resumption support)
  // ISS-003: Process lines in parallel (or sequential if disabled)
  const lineTasks: Array<{ localIndex: number; globalLineIndex: number }> = [];
  for (let i = 0; i < totalLines; i++) {
    const globalLineIndex = lineOffset + i;
    // Skip already-translated lines (resumption)
    if (!translatedLineNumbers.has(globalLineIndex)) {
      lineTasks.push({ localIndex: i, globalLineIndex });
    }
  }

  // ISS-005: Track interruption state
  let interrupted = false;
  let linesCompletedThisTick = 0;

  const lineResults = await Promise.allSettled(
    lineTasks.map(async (task, taskIndex) => {
      const { localIndex: i, globalLineIndex } = task;
      
      // ISS-005: Check budget before starting each line
      if (timeSlicingEnabled && budget && budget.shouldStop()) {
        interrupted = true;
        console.log(
          `[processStanza] ⏱️  Budget exceeded before starting line ${globalLineIndex}, ` +
          `remaining: ${budget.remainingMs()}ms`
        );
        return { success: false, lineIndex: globalLineIndex, skipped: true };
      }

      const lineText = stanza.lines[i];

      const prevLine =
        globalLineIndex > 0 ? flattenedLines[globalLineIndex - 1] : undefined;
      const nextLine =
        globalLineIndex < flattenedLines.length - 1
          ? flattenedLines[globalLineIndex + 1]
          : undefined;

      // Handle empty lines immediately (no translation needed)
      if (!lineText?.trim()) {
        const emptyLine = {
          line_number: globalLineIndex,
          original_text: lineText || "",
          translations: [],
          updated_at: Date.now(),
          translationStatus: "translated" as const,
          alignmentStatus: "skipped" as const,
        };

        try {
          await updateSingleLine(threadId, stanzaIndex, emptyLine);
          linesCompletedThisTick++;
        } catch (error) {
          console.error(
            `[processStanza] Failed to update empty line ${globalLineIndex}:`,
            error
          );
        }
        return { success: true, lineIndex: globalLineIndex, lineData: emptyLine };
      }

      // Acquire permit for translation (bounded concurrency)
      const permit = await limiter.acquire();
      const lineStartTime = Date.now();

      // ISS-005: Check budget again after acquiring permit (may have waited)
      if (timeSlicingEnabled && budget && budget.shouldStop()) {
        permit.release();
        interrupted = true;
        console.log(
          `[processStanza] ⏱️  Budget exceeded after acquiring permit for line ${globalLineIndex}, ` +
          `remaining: ${budget.remainingMs()}ms`
        );
        return { success: false, lineIndex: globalLineIndex, skipped: true };
      }

      try {
        console.log(
          `[processStanza] Starting line ${globalLineIndex} (stanza ${stanzaIndex}, task ${taskIndex + 1}/${lineTasks.length})`
        );

        // Translate the line with error handling
        const selectedModel = guideAnswers.translationModel;
        const translationMethod = guideAnswers.translationMethod ?? "method-2";

        let lineTranslation;

        if (translationMethod === "method-2") {
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
            modelOverride: selectedModel,
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

        // Build line data
        const lineData: TranslatedLine = {
          line_number: globalLineIndex,
          original_text: lineText,
          translations: lineTranslation.translations,
          model_used: lineTranslation.modelUsed,
          updated_at: Date.now(),
          translationStatus: "translated",
        };

        // Add quality metadata for Method 2
        if (
          translationMethod === "method-2" &&
          "qualityMetadata" in lineTranslation
        ) {
          const method2Response = lineTranslation as {
            qualityMetadata?: import("@/types/translationJob").LineQualityMetadata;
          };
          const qualityMetadata = method2Response.qualityMetadata;

          if (qualityMetadata?.quality_tier === "failed") {
            lineData.translationStatus = "failed";
          } else {
            lineData.translationStatus = "translated";
          }

          lineData.alignmentStatus = "skipped";
          lineData.quality_metadata = qualityMetadata;
        } else {
          lineData.translationStatus = "translated";
          lineData.alignmentStatus = "skipped";
        }

        // ISS-003: Update single line immediately (safe for out-of-order completion)
        await updateSingleLine(threadId, stanzaIndex, lineData);
        linesCompletedThisTick++;

        const lineDuration = Date.now() - lineStartTime;
        console.log(
          `[processStanza] Completed line ${globalLineIndex} in ${lineDuration}ms ` +
            `(stanza ${stanzaIndex}, task ${taskIndex + 1}/${lineTasks.length}, ` +
            `budget=${budget ? `${budget.remainingMs()}ms` : "unlimited"})`
        );

        return { success: true, lineIndex: globalLineIndex, lineData };
      } catch (error) {
        const lineDuration = Date.now() - lineStartTime;
        const { code, retryable, message } = classifyError(error);

        console.error(
          `[processStanza] Line ${globalLineIndex} failed after ${lineDuration}ms: ${code} - ${message} (retryable=${retryable})`
        );

        // For retryable errors, don't mark as failed - let stanza-level retry handle it
        // For non-retryable errors, mark line as failed
        if (!retryable) {
          const failedLine: TranslatedLine = {
            line_number: globalLineIndex,
            original_text: lineText,
            translations: [],
            updated_at: Date.now(),
            translationStatus: "failed",
            alignmentStatus: "skipped",
          };

          try {
            await updateSingleLine(threadId, stanzaIndex, failedLine);
          } catch (updateError) {
            console.error(
              `[processStanza] Failed to update failed line ${globalLineIndex}:`,
              updateError
            );
          }
        }

        return {
          success: false,
          lineIndex: globalLineIndex,
          error: { code, retryable, message },
        };
      } finally {
        permit.release();
      }
    })
  );

  // Collect results and check for failures
  const completedLines: TranslatedLine[] = [];
  const failedLines: Array<{
    lineIndex: number;
    error: { code: ErrorCode; retryable: boolean; message: string };
  }> = [];

  for (const result of lineResults) {
    if (result.status === "fulfilled") {
      if (result.value.success && result.value.lineData) {
        completedLines.push(result.value.lineData);
      } else if (!result.value.success) {
        failedLines.push({
          lineIndex: result.value.lineIndex,
          error: result.value.error!,
        });
      }
    } else {
      // Promise rejected (shouldn't happen with try-catch, but handle it)
      console.error(
        `[processStanza] Unexpected rejection for stanza ${stanzaIndex}:`,
        result.reason
      );
    }
  }

  const stanzaDuration = Date.now() - stanzaStartTime;

  // ✅ FIX: Check if ALL lines are actually translated before declaring interrupted
  // Even if the `interrupted` flag was set (budget check triggered), lines that were
  // already in-flight may have completed. If all lines are done, don't treat as interrupted.
  if (interrupted) {
    // Load current state from DB to check actual line completion
    const jobCheckInterrupt = await getTranslationJob(threadId);
    const chunkCheckInterrupt = (jobCheckInterrupt?.chunks || jobCheckInterrupt?.stanzas || {})[stanzaIndex];
    const actualLines = chunkCheckInterrupt?.lines || [];
    const actualAllTranslated = actualLines.length > 0 && actualLines.every(
      (l) => l.translationStatus === "translated"
    );
    const actualAllPresent = actualLines.length === (chunkCheckInterrupt?.totalLines || totalLines);

    if (actualAllTranslated && actualAllPresent) {
      // All lines completed despite interrupt flag - don't return as interrupted
      console.log(
        `[processStanza] ⚠️  Stanza ${stanzaIndex} had interrupt flag but ALL lines completed: ` +
        `${actualLines.length}/${chunkCheckInterrupt?.totalLines || totalLines} lines translated. ` +
        `Proceeding to completion check instead of returning interrupted.`
      );
      // Clear the interrupted flag so we proceed to normal completion logic
      interrupted = false;
    } else {
      // Truly interrupted - some lines still pending
      console.log(
        `[processStanza] ⏱️  Stanza ${stanzaIndex} INTERRUPTED: ` +
        `${linesCompletedThisTick} lines completed this tick, ` +
        `${pendingLineCount - linesCompletedThisTick} remaining, ` +
        `actual DB state: ${actualLines.length}/${chunkCheckInterrupt?.totalLines || totalLines} lines, ` +
        `duration=${stanzaDuration}ms, ` +
        `budget=${budget ? `${budget.remainingMs()}ms remaining` : "N/A"}`
      );

      // Update stanza status to "processing" (not completed)
      await updateStanzaStatus(threadId, stanzaIndex, {
        status: "processing",
      });

      return {
        interrupted: true,
        linesCompleted: linesCompletedThisTick,
        linesTotal: totalLines,
      };
    }
  }

  console.log(
    `[processStanza] Stanza ${stanzaIndex} completed: ${completedLines.length} succeeded, ` +
      `${failedLines.length} failed, duration=${stanzaDuration}ms`
  );

  // ISS-003: Handle retryable errors - re-queue stanza if any retryable failures
  const retryableFailures = failedLines.filter((f) => f.error.retryable);
  const permanentFailures = failedLines.filter((f) => !f.error.retryable);

  if (retryableFailures.length > 0) {
    // ISS-016: Instrument retry telemetry
    const retryTelemetry = createRetryTelemetryCollector(instrumentation?.retries ? { retries: instrumentation.retries } : undefined);
    
    // Check if we should retry (stanza-level retry logic)
    const stanzaState = await updateStanzaStatus(threadId, stanzaIndex, {
      error: retryableFailures[0].error.message,
      error_details: {
        code: retryableFailures[0].error.code,
        timestamp: Date.now(),
        retryable: true,
        message: retryableFailures[0].error.message,
      },
    });

    if (stanzaState) {
      const chunkOrStanzaStates =
        stanzaState.chunks || stanzaState.stanzas || {};
      const currentRetries = chunkOrStanzaStates[stanzaIndex]?.retries ?? 0;
      const maxRetries = chunkOrStanzaStates[stanzaIndex]?.maxRetries ?? 3;

      if (currentRetries < maxRetries) {
        const backoffDelay = calculateBackoffDelay(currentRetries);
        const nextRetryAt = Date.now() + backoffDelay;

        // ISS-016: Record retry attempt
        retryTelemetry.recordRetry({
          layer: "stanza",
          operation: `stanza_${stanzaIndex}`,
          attempt: currentRetries + 1,
          maxAttempts: maxRetries,
          reason: retryableFailures[0].error.message,
          delayMs: backoffDelay,
        });

        await updateStanzaStatus(threadId, stanzaIndex, {
          retries: currentRetries + 1,
          status: "queued",
          nextRetryAt,
        });

        console.warn(
          `[processStanza] Stanza ${stanzaIndex} has ${retryableFailures.length} retryable failures, ` +
            `re-queuing (retry ${currentRetries + 1}/${maxRetries})`
        );

        throw new Error(
          `Stanza ${stanzaIndex} has retryable errors - re-queued for retry`
        );
      }
    }
  }

  // Update stanza status with final state
  // Note: We set "processing" here; the caller (runTranslationTick) will mark as "completed"
  // if all lines are translated. The watchdog (fixStuckChunks) provides a safety net.
  await updateStanzaStatus(threadId, stanzaIndex, {
    status: permanentFailures.length > 0 ? "failed" : "processing",
  });

  // ✅ SAFETY: If all lines are translated, mark chunk as completed here
  // This is a defense-in-depth fix: normally runTranslationTick handles this,
  // but if that update fails, we still want the chunk to be marked completed.
  if (permanentFailures.length === 0 && !interrupted) {
    const jobAfterUpdate = await getTranslationJob(threadId);
    const chunkAfterUpdate = (jobAfterUpdate?.chunks || jobAfterUpdate?.stanzas || {})[stanzaIndex];

    if (chunkAfterUpdate) {
      const chunkLines = chunkAfterUpdate.lines || [];
      const allLinesTranslated = chunkLines.length > 0 && chunkLines.every(
        (l) => l.translationStatus === "translated"
      );
      const allLinesPresent = chunkLines.length === chunkAfterUpdate.totalLines;

      // ✅ DEBUG: Log safety completion check details
      console.log(
        `[processStanza] Safety completion check for chunk ${stanzaIndex}: ` +
        `lines=${chunkLines.length}/${chunkAfterUpdate.totalLines}, ` +
        `allTranslated=${allLinesTranslated}, allPresent=${allLinesPresent}, ` +
        `currentStatus=${chunkAfterUpdate.status}`
      );

      if (allLinesTranslated && allLinesPresent && chunkAfterUpdate.status !== "completed") {
        console.log(
          `[processStanza] Safety completion: marking chunk ${stanzaIndex} as completed ` +
          `(lines: ${chunkLines.length}/${chunkAfterUpdate.totalLines})`
        );
        await updateStanzaStatus(threadId, stanzaIndex, {
          status: "completed",
          completedAt: Date.now(),
          error: undefined,
        });
      }
    }
  } else {
    // ✅ DEBUG: Log why safety completion was skipped
    console.log(
      `[processStanza] Safety completion SKIPPED for chunk ${stanzaIndex}: ` +
      `permanentFailures=${permanentFailures.length}, interrupted=${interrupted}`
    );
  }

  // Legacy: Build translatedLines array for final validation (backwards compatibility)
  // Lines are already stored in DB via updateSingleLine, but we need the array for validation
  // ISS-005: If interrupted, load existing lines from DB to build complete array
  if (interrupted) {
    // Load existing lines from job state for validation
    const jobAfterInterrupt = await getTranslationJob(threadId);
    const chunkOrStanzaStatesAfter = jobAfterInterrupt?.chunks || jobAfterInterrupt?.stanzas || {};
    const stanzaAfter = chunkOrStanzaStatesAfter[stanzaIndex];
    if (stanzaAfter?.lines) {
      translatedLines.push(...stanzaAfter.lines);
    }
  } else {
    // Normal completion: build from completed lines
    const allLines = [...completedLines];
    
    // Add empty lines that were processed
    for (let i = 0; i < totalLines; i += 1) {
      const lineText = stanza.lines[i];
      const globalLineIndex = lineOffset + i;
      
      if (!lineText?.trim()) {
        const emptyLine = {
          line_number: globalLineIndex,
          original_text: lineText || "",
          translations: [],
          updated_at: Date.now(),
          translationStatus: "translated" as const,
          alignmentStatus: "skipped" as const,
        };
        allLines.push(emptyLine);
      }
    }
    
    // Sort by line_number for validation
    allLines.sort((a, b) => a.line_number - b.line_number);
    translatedLines.push(...allLines);
  }

  // ✅ FINAL VALIDATION: Ensure all lines were processed (only if not interrupted)
  if (!interrupted) {
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

  return {
    interrupted: false,
    linesCompleted: completedLines.length,
    linesTotal: totalLines,
  };
}
