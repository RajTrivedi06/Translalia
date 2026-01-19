/**
 * Automatic retry mechanism for failed translation lines
 *
 * This module provides automatic retry functionality for lines that fail during translation.
 * It runs as part of the translation tick process to detect and retry failed lines without
 * requiring manual intervention from users.
 *
 * Features:
 * - Detects failed lines across all chunks
 * - Respects max retry limits per line
 * - Exponential backoff between retries
 * - Logs detailed retry attempts for debugging
 */

import type {
  TranslationJobState,
  TranslatedLine,
} from "@/types/translationJob";
import type { StanzaDetectionResult } from "@/lib/poem/stanzaDetection";
import type { GuideAnswers } from "@/store/guideSlice";
import { translateLineInternal } from "@/lib/workshop/translateLineInternal";
import { translateLineWithRecipesInternal } from "@/lib/translation/method2/translateLineWithRecipesInternal";
import { updateStanzaStatus } from "@/lib/workshop/jobState";
import { createRetryTelemetryCollector } from "@/lib/telemetry/retryTelemetry";
import type { TickInstrumentation } from "./runTranslationTick";

const MAX_LINE_RETRIES = 3;
const RETRY_BACKOFF_BASE = 5000; // 5 seconds base delay
const RETRY_BACKOFF_MAX = 60000; // 60 seconds max delay

interface FailedLineInfo {
  stanzaIndex: number;
  lineIndex: number;
  line: TranslatedLine;
  retryCount: number;
}

interface AutoRetryContext {
  threadId: string;
  stanzaResult: StanzaDetectionResult;
  rawPoem: string;
  guideAnswers: GuideAnswers;
  sourceLanguage: string;
  auditUserId?: string;
  auditProjectId?: string | null;
  instrumentation?: TickInstrumentation;
}

/**
 * Calculate exponential backoff delay for line retry
 */
function calculateRetryDelay(retryCount: number): number {
  const delay = RETRY_BACKOFF_BASE * Math.pow(2, retryCount);
  return Math.min(delay, RETRY_BACKOFF_MAX);
}

/**
 * Check if enough time has passed since last retry attempt
 */
function shouldRetryNow(line: TranslatedLine): boolean {
  if (!line.updated_at) return true;

  const retryCount = line.retry_count ?? 0;
  const delay = calculateRetryDelay(retryCount);
  const timeSinceUpdate = Date.now() - line.updated_at;

  return timeSinceUpdate >= delay;
}

/**
 * Find all failed lines across all chunks that are eligible for retry
 */
export function findRetryableLines(job: TranslationJobState): FailedLineInfo[] {
  const retryableLines: FailedLineInfo[] = [];
  const chunkOrStanzaStates = job.chunks || job.stanzas || {};

  Object.entries(chunkOrStanzaStates).forEach(([indexStr, chunk]) => {
    const stanzaIndex = parseInt(indexStr, 10);
    const lines = chunk.lines || [];

    lines.forEach((line, lineIndex) => {
      // Check if line is failed and hasn't exceeded retry limit
      if (line.translationStatus === "failed") {
        const retryCount = line.retry_count ?? 0;

        // Check if we should retry this line
        if (retryCount < MAX_LINE_RETRIES && shouldRetryNow(line)) {
          retryableLines.push({
            stanzaIndex,
            lineIndex,
            line,
            retryCount,
          });
        } else if (retryCount >= MAX_LINE_RETRIES) {
          console.warn(
            `[autoRetry] Line ${line.line_number} in stanza ${stanzaIndex} has exhausted retries (${retryCount}/${MAX_LINE_RETRIES})`
          );
        }
      }
    });
  });

  return retryableLines;
}

/**
 * Retry a single failed line
 */
async function retryLine(
  failedLine: FailedLineInfo,
  context: AutoRetryContext
): Promise<boolean> {
  const { stanzaIndex, lineIndex, line } = failedLine;
  const {
    threadId,
    stanzaResult,
    rawPoem,
    guideAnswers,
    sourceLanguage,
    auditUserId,
    auditProjectId,
  } = context;

  // ISS-016: Instrument retry telemetry
  const retryTelemetry = createRetryTelemetryCollector(
    context.instrumentation?.retries ? { retries: context.instrumentation.retries } : undefined
  );
  const attemptNumber = (line.retry_count ?? 0) + 1;
  
  retryTelemetry.recordRetry({
    layer: "line",
    operation: `line_${line.line_number}_stanza_${stanzaIndex}`,
    attempt: attemptNumber,
    maxAttempts: MAX_LINE_RETRIES,
    reason: line.translationStatus === "failed" ? "Previous translation failed" : undefined,
    delayMs: calculateRetryDelay(line.retry_count ?? 0),
  });

  console.log(
    `[autoRetry] Retrying line ${line.line_number} in stanza ${stanzaIndex} (attempt ${attemptNumber}/${MAX_LINE_RETRIES})`
  );

  try {
    // Get stanza and line context
    const stanza = stanzaResult.stanzas[stanzaIndex];
    if (!stanza) {
      console.error(
        `[autoRetry] Stanza ${stanzaIndex} not found in stanza result`
      );
      return false;
    }

    // Calculate line offset
    let lineOffset = 0;
    for (let i = 0; i < stanzaIndex; i++) {
      lineOffset += stanzaResult.stanzas[i].lines.length;
    }

    const flattenedLines = stanzaResult.stanzas.flatMap((s) => s.lines);
    const lineNumber = line.line_number;
    const lineText = line.original_text;

    const prevLine =
      lineNumber > 0 ? flattenedLines[lineNumber - 1] : undefined;
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

    // Retry the translation
    let lineTranslation;
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
        auditUserId,
        auditProjectId,
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
        audit:
          auditUserId !== undefined
            ? {
                createdBy: auditUserId,
                projectId: auditProjectId ?? null,
                stage: "workshop-auto-retry-line",
              }
            : undefined,
      });
    }

    // Update the line with retry results
    const updatedLine: TranslatedLine = {
      ...line,
      translations: lineTranslation.translations,
      model_used: lineTranslation.modelUsed,
      updated_at: Date.now(),
      translationStatus: "translated", // Mark as translated if retry succeeded
      retry_count: (line.retry_count ?? 0) + 1,
      quality_metadata:
        translationMethod === "method-2" && "qualityMetadata" in lineTranslation
          ? (lineTranslation.qualityMetadata as import("@/types/translationJob").LineQualityMetadata)
          : line.quality_metadata,
    };

    // Update the chunk with the retried line
    // We need to get the current chunk state and update just this line
    const result = await updateStanzaStatus(threadId, stanzaIndex, {
      lines: undefined, // Will be updated by merge logic
    });

    if (!result) {
      console.error(
        `[autoRetry] Failed to get job state after retry for line ${lineNumber}`
      );
      return false;
    }

    const chunkOrStanzaStates = result.chunks || result.stanzas || {};
    const chunk = chunkOrStanzaStates[stanzaIndex];
    if (!chunk || !chunk.lines) {
      console.error(
        `[autoRetry] Chunk ${stanzaIndex} or lines array missing after retry`
      );
      return false;
    }

    // Update the specific line in the chunk
    const updatedLines = [...chunk.lines];
    updatedLines[lineIndex] = updatedLine;

    // Check if all lines are now translated
    const allLinesTranslated = updatedLines.every(
      (l) => l.translationStatus === "translated"
    );

    await updateStanzaStatus(threadId, stanzaIndex, {
      lines: updatedLines,
      status: allLinesTranslated ? "completed" : chunk.status,
      linesProcessed: updatedLines.filter(
        (l) => l.translationStatus === "translated"
      ).length,
    });

    console.log(
      `[autoRetry] Successfully retried line ${lineNumber} in stanza ${stanzaIndex}`
    );
    return true;
  } catch (error) {
    console.error(
      `[autoRetry] Failed to retry line ${line.line_number} in stanza ${stanzaIndex}:`,
      error
    );

    // Mark the line as failed with incremented retry count
    const result = await updateStanzaStatus(threadId, stanzaIndex, {
      lines: undefined,
    });

    if (result) {
      const chunkOrStanzaStates = result.chunks || result.stanzas || {};
      const chunk = chunkOrStanzaStates[stanzaIndex];
      if (chunk?.lines) {
        const updatedLines = [...chunk.lines];
        updatedLines[lineIndex] = {
          ...line,
          retry_count: (line.retry_count ?? 0) + 1,
          updated_at: Date.now(),
        };

        await updateStanzaStatus(threadId, stanzaIndex, {
          lines: updatedLines,
        });
      }
    }

    return false;
  }
}

/**
 * Automatically retry all failed lines in a job
 *
 * This function is called during translation ticks to detect and retry failed lines.
 * It respects retry limits and backoff delays to avoid overwhelming the API.
 */
export async function autoRetryFailedLines(
  job: TranslationJobState,
  context: AutoRetryContext
): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  const retryableLines = findRetryableLines(job);

  if (retryableLines.length === 0) {
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  console.log(
    `[autoRetry] Found ${retryableLines.length} lines eligible for automatic retry`
  );

  let succeeded = 0;
  let failed = 0;

  // Retry lines sequentially to avoid rate limits
  // In the future, we could make this parallel with a concurrency limit
  for (const failedLine of retryableLines) {
    const success = await retryLine(failedLine, context);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  console.log(
    `[autoRetry] Retry complete: ${succeeded} succeeded, ${failed} failed out of ${retryableLines.length} attempted`
  );

  return {
    attempted: retryableLines.length,
    succeeded,
    failed,
  };
}

/**
 * Get statistics about failed lines in a job
 */
export function getFailedLinesStats(job: TranslationJobState): {
  totalFailed: number;
  retryable: number;
  exhausted: number;
  byStanza: Record<number, number>;
} {
  const stats = {
    totalFailed: 0,
    retryable: 0,
    exhausted: 0,
    byStanza: {} as Record<number, number>,
  };

  const chunkOrStanzaStates = job.chunks || job.stanzas || {};

  Object.entries(chunkOrStanzaStates).forEach(([indexStr, chunk]) => {
    const stanzaIndex = parseInt(indexStr, 10);
    const lines = chunk.lines || [];

    const failedInStanza = lines.filter(
      (line) => line.translationStatus === "failed"
    );

    if (failedInStanza.length > 0) {
      stats.totalFailed += failedInStanza.length;
      stats.byStanza[stanzaIndex] = failedInStanza.length;

      failedInStanza.forEach((line) => {
        const retryCount = line.retry_count ?? 0;
        if (retryCount < MAX_LINE_RETRIES) {
          stats.retryable++;
        } else {
          stats.exhausted++;
        }
      });
    }
  });

  return stats;
}
