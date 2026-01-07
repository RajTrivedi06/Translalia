import type { Stanza } from "@/lib/poem/stanzaDetection";
import type { GuideAnswers } from "@/store/guideSlice";
import type { TranslatedLine, ErrorCode } from "@/types/translationJob";

import { translateLineInternal } from "@/lib/workshop/translateLineInternal";
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
      // Record empty line
      translatedLines.push({
        line_number: globalLineIndex,
        original_text: lineText,
        translations: [],
        updated_at: Date.now(),
      });

      await updateStanzaStatus(threadId, stanzaIndex, {
        linesProcessed: i + 1,
        lastLineTranslated: globalLineIndex,
      });
      continue;
    }

    // Translate the line with error handling (Feature 9)
    // Use user-selected model from guideAnswers (not env default)
    const selectedModel = guideAnswers.translationModel;

    try {
      const lineTranslation = await translateLineInternal({
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

      // Store translated line with full results (Feature 8)
      translatedLines.push({
        line_number: globalLineIndex,
        original_text: lineText,
        translations: lineTranslation.translations,
        model_used: lineTranslation.modelUsed,
        updated_at: Date.now(),
      });

      await updateStanzaStatus(threadId, stanzaIndex, {
        status: "processing",
        linesProcessed: i + 1,
        lastLineTranslated: globalLineIndex,
        // Feature 8: Store all translated lines so far
        lines: translatedLines,
      });
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

      // Permanent error or max retries exceeded: mark stanza as failed
      await updateStanzaStatus(threadId, stanzaIndex, {
        status: "failed",
        retries:
          stanzaState?.chunks?.[stanzaIndex]?.retries ??
          stanzaState?.stanzas?.[stanzaIndex]?.retries ??
          0,
      });

      console.error(
        `[processStanza] Stanza ${stanzaIndex} failed (${code}): ${message}`
      );
      throw error; // Propagate to stop processing this stanza
    }
  }
}
