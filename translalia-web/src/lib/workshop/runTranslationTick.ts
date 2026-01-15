import { supabaseServer } from "@/lib/supabaseServer";
import type { StanzaDetectionResult } from "@/lib/poem/stanzaDetection";
import type { GuideAnswers } from "@/store/guideSlice";
import type {
  TranslationJobState,
  TranslationTickResult,
} from "@/types/translationJob";

import {
  getTranslationJob,
  getNextStanzasToProcess,
  updateTranslationJob,
  markJobCompletedIfDone,
  computeProcessingStatus,
} from "@/lib/workshop/jobState";
import { processStanza } from "@/lib/workshop/processStanza";
import { createRateLimitedPool } from "@/lib/workshop/rateLimitedPool";

export interface RunTranslationTickOptions {
  maxProcessingTimeMs?: number;
  maxStanzasPerTick?: number;
}

interface ThreadContext {
  guideAnswers: GuideAnswers;
  rawPoem: string;
  stanzaResult: StanzaDetectionResult;
  sourceLanguage: string;
  createdBy: string;
  projectId: string | null;
}

export async function loadThreadContext(
  threadId: string
): Promise<ThreadContext> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("state, created_by, project_id")
    .eq("id", threadId)
    .single();

  if (error || !data) {
    throw new Error(
      `[runTranslationTick] Failed to load thread ${threadId}: ${error?.message}`
    );
  }

  const state = (data.state as Record<string, unknown>) || {};
  const guideAnswers = (state.guide_answers as GuideAnswers) || {};
  const stanzaResult = state.poem_stanzas as StanzaDetectionResult | undefined;
  const rawPoem = (state.raw_poem as string) || "";
  const poemAnalysis = (state.poem_analysis as { language?: string }) || {};

  if (!stanzaResult?.stanzas || stanzaResult.stanzas.length === 0) {
    throw new Error("[runTranslationTick] Poem stanzas missing");
  }

  if (!rawPoem) {
    throw new Error("[runTranslationTick] Raw poem text missing");
  }

  return {
    guideAnswers,
    rawPoem,
    stanzaResult,
    sourceLanguage: poemAnalysis.language || "the source language",
    createdBy: data.created_by,
    projectId: data.project_id ?? null,
  };
}

function computeLineOffsets(stanzas: StanzaDetectionResult["stanzas"]) {
  const offsets: number[] = [];
  let offset = 0;
  for (const stanza of stanzas) {
    offsets.push(offset);
    offset += stanza.lines.length;
  }
  return offsets;
}

function cloneGuidePreferences(
  preferences: GuideAnswers | undefined
): Record<string, unknown> | undefined {
  if (!preferences) {
    return undefined;
  }

  const cloneFn = (
    globalThis as {
      structuredClone?: (value: unknown) => unknown;
    }
  ).structuredClone;

  if (typeof cloneFn === "function") {
    return cloneFn(preferences) as Record<string, unknown>;
  }

  return JSON.parse(JSON.stringify(preferences)) as Record<string, unknown>;
}

export async function runTranslationTick(
  threadId: string,
  options: RunTranslationTickOptions = {}
): Promise<TranslationTickResult | null> {
  // Note: guide preferences are reloaded on every tick. Stanzas already completed
  // reflect the preferences that were active at the time they finished. Use the
  // requeue endpoint to regenerate a stanza after preferences change.
  const job = await getTranslationJob(threadId);
  if (!job) {
    return null;
  }

  const context = await loadThreadContext(threadId);
  const { stanzaResult, rawPoem, guideAnswers, sourceLanguage, createdBy } =
    context;

  const guidePreferencesSnapshot = cloneGuidePreferences(guideAnswers);
  const totalStanzas = stanzaResult.stanzas.length;
  const applyMetadata = (draft: TranslationJobState) => {
    if (draft.full_poem !== rawPoem) {
      draft.full_poem = rawPoem;
    }
    if (guidePreferencesSnapshot) {
      draft.guide_preferences = guidePreferencesSnapshot;
    }
    draft.total_stanzas = totalStanzas;
  };

  const flattenedLines = stanzaResult.stanzas.flatMap((stanza) => stanza.lines);
  const lineOffsets = computeLineOffsets(stanzaResult.stanzas);

  // Feature 7: Check rate limits before processing (Essential)
  const rateLimitedPool = createRateLimitedPool(createdBy, {
    limit: 10, // 10 stanzas per minute per user
    windowSeconds: 60,
  });

  let started: number[] = [];
  let updatedJob: TranslationJobState | null = null;

  updatedJob = await updateTranslationJob(threadId, (draft) => {
    applyMetadata(draft);
    const picks = getNextStanzasToProcess(draft);
    const limited = picks.slice(
      0,
      options.maxStanzasPerTick ?? draft.maxStanzasPerTick
    );

    if (limited.length === 0) {
      return markJobCompletedIfDone(draft);
    }

    started = limited;

    const now = Date.now();
    draft.status = "processing";
    draft.queue = draft.queue.filter((index) => !limited.includes(index));

    limited.forEach((index) => {
      const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
      const stanzaState = chunkOrStanzaStates[index];
      if (!stanzaState) return;
      stanzaState.status = "processing";
      stanzaState.startedAt = stanzaState.startedAt ?? now;
      stanzaState.error = undefined;
      if (!draft.active.includes(index)) {
        draft.active.push(index);
      }
    });

    return draft;
  });

  if (!updatedJob) {
    return null;
  }

  if (started.length === 0) {
    return {
      job: updatedJob,
      startedChunks: [],
      startedStanzas: [],
      completedChunks: [],
      completedStanzas: [],
      hasWorkRemaining: updatedJob.status !== "completed",
    };
  }

  // Feature 7: Check rate limit and backoff before processing stanzas
  const stanzaRetries: Record<number, number> = {};
  const stanzaBackoffUntil: Record<number, number> = {};
  const chunkOrStanzaStates = updatedJob.chunks || updatedJob.stanzas || {};
  Object.entries(chunkOrStanzaStates).forEach(([idx, stanza]) => {
    if (stanza.retries) {
      stanzaRetries[parseInt(idx, 10)] = stanza.retries;
    }
    if (stanza.nextRetryAt) {
      stanzaBackoffUntil[parseInt(idx, 10)] = stanza.nextRetryAt;
    }
  });

  const dequeueResult = await rateLimitedPool.checkAndDequeue(
    started,
    stanzaRetries,
    stanzaBackoffUntil
  );

  // Update job with rate limit status
  updatedJob.rateLimitStatus = {
    remaining: dequeueResult.remaining,
    limit: 10,
    reset: dequeueResult.resetAt,
  };
  applyMetadata(updatedJob);

  // If rate limited, re-queue stanzas and return
  if (dequeueResult.rateLimited || dequeueResult.stanzas.length === 0) {
    await updateTranslationJob(threadId, (draft) => {
      started.forEach((index) => {
        const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
        const stanzaState = chunkOrStanzaStates[index];
        if (stanzaState) {
          stanzaState.status = "queued";
        }
        draft.active = draft.active.filter((id) => id !== index);
        if (!draft.queue.includes(index)) {
          draft.queue.unshift(index);
        }
      });
      applyMetadata(draft);
      draft.rateLimitStatus = {
        remaining: dequeueResult.remaining,
        limit: 10,
        reset: dequeueResult.resetAt,
      };
      return draft;
    });

    return {
      job: (await getTranslationJob(threadId)) || updatedJob,
      startedChunks: [],
      startedStanzas: [],
      completedChunks: [],
      completedStanzas: [],
      hasWorkRemaining: true,
    };
  }

  // Update started to only those approved by rate limiter
  started = dequeueResult.stanzas;

  const completed: number[] = [];
  const failed: number[] = [];
  const skipped: number[] = [];
  const maxProcessingTime = options.maxProcessingTimeMs ?? 8000;
  const windowStart = Date.now();

  // Process chunks in parallel with Promise.allSettled
  console.log(`[runTranslationTick] Processing ${started.length} chunks in parallel`);
  const processingPromises = started.map(async (stanzaIndex) => {
    // Check timeout before starting
    if (Date.now() - windowStart > maxProcessingTime) {
      return { stanzaIndex, status: 'skipped' as const };
    }

    const stanza = stanzaResult.stanzas[stanzaIndex];
    if (!stanza) {
      return { stanzaIndex, status: 'failed' as const, error: new Error('Stanza not found') };
    }

    try {
      await processStanza({
        threadId,
        stanzaIndex,
        stanza,
        lineOffset: lineOffsets[stanzaIndex] ?? 0,
        flattenedLines,
        rawPoem,
        guideAnswers,
        sourceLanguage,
        auditUserId: context.createdBy,
        auditProjectId: context.projectId,
      });

      // ✅ CRITICAL FIX: Only mark chunk as completed if ALL lines are translated
      await updateTranslationJob(threadId, (draft) => {
        applyMetadata(draft);
        const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
        const stanzaState = chunkOrStanzaStates[stanzaIndex];
        if (stanzaState) {
          // Check if all lines in this chunk are actually translated
          const lines = stanzaState.lines || [];
          const allLinesTranslated = lines.every(
            (line) => line.translationStatus === "translated"
          );
          const hasFailedLines = lines.some(
            (line) => line.translationStatus === "failed"
          );

          if (allLinesTranslated && lines.length > 0) {
            // All lines successfully translated
            stanzaState.status = "completed";
            stanzaState.completedAt = Date.now();
            stanzaState.linesProcessed = stanzaState.totalLines;
            stanzaState.error = undefined;
            console.log(
              `[runTranslationTick] Chunk ${stanzaIndex} completed: all ${lines.length} lines translated`
            );
          } else if (hasFailedLines) {
            // Some lines failed - mark chunk as failed
            stanzaState.status = "failed";
            stanzaState.completedAt = Date.now();
            const failedCount = lines.filter(
              (l) => l.translationStatus === "failed"
            ).length;
            const translatedCount = lines.filter(
              (l) => l.translationStatus === "translated"
            ).length;
            stanzaState.error = `${failedCount} line(s) failed, ${translatedCount} succeeded`;
            console.warn(
              `[runTranslationTick] Chunk ${stanzaIndex} failed: ${failedCount} lines failed, ${translatedCount} translated`
            );
          } else {
            // Lines still pending - keep as processing
            console.warn(
              `[runTranslationTick] Chunk ${stanzaIndex} finished but has incomplete lines (expected bug fix to prevent this)`
            );
            stanzaState.status = "processing"; // Don't mark as completed
          }
        }
        draft.active = draft.active.filter((index) => index !== stanzaIndex);
        return markJobCompletedIfDone(draft);
      });

      return { stanzaIndex, status: 'completed' as const };
    } catch (error: unknown) {
      console.error(
        `[runTranslationTick] Failed to process stanza ${stanzaIndex} for ${threadId}`,
        error
      );

      // Update job state to mark chunk as failed
      await updateTranslationJob(threadId, (draft) => {
        applyMetadata(draft);
        const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
        const stanzaState = chunkOrStanzaStates[stanzaIndex];
        if (stanzaState) {
          stanzaState.status = "failed";
          stanzaState.completedAt = Date.now();
          stanzaState.error =
            error instanceof Error ? error.message : "Unknown error";
        }
        draft.lastError =
          error instanceof Error ? error.message : "Unknown error";
        draft.active = draft.active.filter((index) => index !== stanzaIndex);
        return draft;
      });

      return { stanzaIndex, status: 'failed' as const, error };
    }
  });

  const results = await Promise.allSettled(processingPromises);

  // Categorize results
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      const { stanzaIndex, status } = result.value;
      if (status === 'completed') {
        completed.push(stanzaIndex);
      } else if (status === 'skipped') {
        skipped.push(stanzaIndex);
      } else if (status === 'failed') {
        failed.push(stanzaIndex);
      }
    } else {
      // Promise rejected (shouldn't happen with try-catch, but handle it)
      console.error('[runTranslationTick] Unexpected rejection:', result.reason);
      const stanzaIndex = started[idx];
      if (stanzaIndex !== undefined) {
        failed.push(stanzaIndex);
      }
    }
  });

  console.log(`[runTranslationTick] Parallel processing complete: ${completed.length} completed, ${failed.length} failed, ${skipped.length} skipped`);

  if (skipped.length > 0) {
    await updateTranslationJob(threadId, (draft) => {
      applyMetadata(draft);
      skipped.forEach((index) => {
        const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
        const stanzaState = chunkOrStanzaStates[index];
        if (stanzaState) {
          stanzaState.status = "queued";
        }
        draft.active = draft.active.filter((id) => id !== index);
        if (!draft.queue.includes(index)) {
          draft.queue.unshift(index);
        }
      });
      return draft;
    });
  }

  const finalJob = await getTranslationJob(threadId);
  if (!finalJob) {
    return null;
  }

  // Feature 8: Update processing status aggregates
  finalJob.processing_status = computeProcessingStatus(finalJob);

  return {
    job: finalJob,
    startedChunks: started,
    startedStanzas: started,
    completedChunks: completed,
    completedStanzas: completed,
    hasWorkRemaining: finalJob.status !== "completed",
  };
}
