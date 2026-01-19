import { randomUUID } from "node:crypto";

import { supabaseServer } from "@/lib/supabaseServer";
import type {
  TranslationJobContext,
  TranslationJobState,
  TranslationChunkState,
  TranslationStanzaState,
  TranslationTickResult,
  ProcessingStatus,
} from "@/types/translationJob";
import { createRetryTelemetryCollector, noOpRetryTelemetry } from "@/lib/telemetry/retryTelemetry";
import type { TickInstrumentation } from "./runTranslationTick";

const DEFAULT_MAX_CONCURRENT = 5;
const DEFAULT_MAX_STANZAS_PER_TICK = 5; // Increased from 2 to match maxConcurrent for parallel processing
const DEFAULT_MAX_RETRIES = 3;

interface ThreadState {
  translation_job?: TranslationJobState;
  [key: string]: unknown;
}

/**
 * Compute processing status aggregates from stanzas
 */
function computeProcessingStatus(job: TranslationJobState): ProcessingStatus {
  const status: ProcessingStatus = {
    completed: 0,
    processing: 0,
    queued: 0,
    failed: 0,
  };

  // Use chunks (new) or stanzas (legacy) for compatibility
  const chunkOrStanzaStates = job.chunks || job.stanzas || {};
  Object.values(chunkOrStanzaStates).forEach((chunk) => {
    if (chunk.status === "completed") {
      status.completed += 1;
    } else if (chunk.status === "processing") {
      status.processing += 1;
    } else if (chunk.status === "queued" || chunk.status === "pending") {
      status.queued += 1;
    } else if (chunk.status === "failed") {
      status.failed += 1;
    }
  });

  return status;
}

function ensureQueuedCapacity(job: TranslationJobState): void {
  const chunkOrStanzaStates = job.chunks || job.stanzas || {};
  const queuedCount = job.queue.filter(
    (index) => chunkOrStanzaStates[index]?.status === "queued"
  ).length;

  if (queuedCount >= job.maxConcurrent) {
    return;
  }

  let promoted = 0;
  for (const index of job.queue) {
    const stanza = chunkOrStanzaStates[index];
    if (!stanza) continue;

    if (stanza.status === "pending") {
      stanza.status = "queued";
      promoted += 1;
    }

    if (queuedCount + promoted >= job.maxConcurrent) {
      break;
    }
  }
}

async function fetchThreadState(threadId: string): Promise<ThreadState> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("state")
    .eq("id", threadId)
    .single();

  if (error) {
    throw new Error(
      `[jobState] Failed to load thread state for ${threadId}: ${error.message}`
    );
  }

  return ((data?.state as ThreadState) ?? {}) as ThreadState;
}

/**
 * Helper to log state writer activity before write
 */
function logStateWrite(
  writer: string,
  threadId: string,
  state: ThreadState,
  previousVersion?: number,
  fieldPath?: string[]
): void {
  const translationJob = state.translation_job;
  const jobVersion = translationJob?.version ?? "none";
  const chunks = translationJob?.chunks || {};
  const chunk0Lines = chunks[0]?.lines?.length ?? "none";
  const chunk1Lines = chunks[1]?.lines?.length ?? "none";
  const activeIndices = translationJob?.active || [];
  const queueLength = translationJob?.queue?.length ?? "none";
  const activeLength = activeIndices.length;
  const activeDisplay = activeLength > 0 ? `[${activeIndices.join(",")}]` : "[]";
  
  const versionCheck = previousVersion !== undefined ? "yes" : "no";
  const writingVersion = translationJob?.version ?? "none";
  const prevSeenVersion = previousVersion ?? "none";
  
  const updatingPart = fieldPath && Array.isArray(fieldPath) && fieldPath.length > 0 ? ` updating=${fieldPath.join(".")}` : "";
  
  console.log(
    `[STATE_WRITE] writer=${writer} threadId=${threadId} jobVersion=${jobVersion} ` +
    `chunks[0].lines=${chunk0Lines} chunks[1].lines=${chunk1Lines} ` +
    `queue.length=${queueLength} active=${activeDisplay}${updatingPart} ` +
    `versionCheck=${versionCheck} prevSeenVersion=${prevSeenVersion} writingVersion=${writingVersion}`
  );
}

async function writeThreadState(
  threadId: string,
  state: ThreadState,
  previousVersion?: number
): Promise<void> {
  // ✅ LOG: State write activity
  logStateWrite("writeThreadState", threadId, state, previousVersion);
  
  const supabase = await supabaseServer();
  let query = supabase
    .from("chat_threads")
    .update({ state })
    .eq("id", threadId);

  if (previousVersion !== undefined) {
    query = query.eq(
      "state->translation_job->>version",
      previousVersion.toString()
    );
  }

  const { error, data } = await query.select("id");

  if (error) {
    throw new Error(
      `[jobState] Failed to persist translation job for ${threadId}: ${error.message}`
    );
  }

  if (previousVersion !== undefined && (!data || data.length === 0)) {
    throw new Error("[jobState] Translation job modified concurrently");
  }
}

export async function getTranslationJob(
  threadId: string
): Promise<TranslationJobState | null> {
  const state = await fetchThreadState(threadId);
  return state.translation_job ?? null;
}

export async function createTranslationJob(
  context: TranslationJobContext,
  options?: {
    maxConcurrent?: number;
    maxStanzasPerTick?: number;
    guidePreferences?: Record<string, unknown>;
  }
): Promise<TranslationJobState> {
  const { threadId, chunks, stanzas, poem } = context;
  const state = await fetchThreadState(threadId);

  if (state.translation_job) {
    return state.translation_job;
  }

  const now = Date.now();
  // Use chunks if available, otherwise fall back to stanzas
  const chunksToUse = chunks || stanzas || [];
  const queue = chunksToUse.map((_, index) => index);

  const chunkStates: Record<number, TranslationChunkState> = {};
  const stanzaStates: Record<number, TranslationStanzaState> = {};

  chunksToUse.forEach((chunk, index) => {
    const chunkState: TranslationChunkState = {
      chunkIndex: index,
      status: index === 0 ? "queued" : "pending",
      linesProcessed: 0,
      totalLines: chunk.lines.length,
      retries: 0,
      maxRetries: DEFAULT_MAX_RETRIES,
      lines: [],
    };

    chunkStates[index] = chunkState;

    // Also create stanza state for backward compatibility
    stanzaStates[index] = {
      stanzaIndex: index,
      status: index === 0 ? "queued" : "pending",
      linesProcessed: 0,
      totalLines: chunk.lines.length,
      retries: 0,
      maxRetries: DEFAULT_MAX_RETRIES,
      lines: [],
    };
  });

  const job: TranslationJobState = {
    jobId: randomUUID(),
    version: 1,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    maxConcurrent: options?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT,
    maxChunksPerTick:
      options?.maxStanzasPerTick ?? DEFAULT_MAX_STANZAS_PER_TICK,
    maxStanzasPerTick:
      options?.maxStanzasPerTick ?? DEFAULT_MAX_STANZAS_PER_TICK,
    queue,
    active: [],
    chunks: chunkStates,
    stanzas: stanzaStates,
    // Feature 8: Persist full poem and guide preferences
    full_poem: poem,
    guide_preferences: options?.guidePreferences,
    total_chunks: chunksToUse.length,
    total_stanzas: chunksToUse.length,
  };

  ensureQueuedCapacity(job);

  state.translation_job = job;
  job.processing_status = computeProcessingStatus(job);
  await writeThreadState(threadId, state);
  return job;
}

type JobUpdater = (job: TranslationJobState) => TranslationJobState | null;

/**
 * Monotonicity check: Detect if verified state has REGRESSED compared to what we intended to write.
 * This catches state clobber from unsafe writers (e.g., audit writes overwriting translation_job).
 *
 * Returns an error message if regression detected, null otherwise.
 */
function checkMonotonicity(
  intended: TranslationJobState,
  verified: TranslationJobState | undefined,
  threadId: string
): string | null {
  if (!verified) {
    return `[MONOTONICITY] threadId=${threadId} verified job is null/undefined after write!`;
  }

  const errors: string[] = [];

  // Check version regression
  if (verified.version < intended.version) {
    errors.push(
      `version regressed: intended=${intended.version} verified=${verified.version}`
    );
  }

  // Check chunk-level regressions
  const intendedChunks = intended.chunks || {};
  const verifiedChunks = verified.chunks || {};

  for (const [idxStr, intendedChunk] of Object.entries(intendedChunks)) {
    const idx = parseInt(idxStr, 10);
    const verifiedChunk = verifiedChunks[idx];

    if (!verifiedChunk) {
      errors.push(`chunk[${idx}] missing in verified state`);
      continue;
    }

    // Check linesProcessed regression
    if (verifiedChunk.linesProcessed < intendedChunk.linesProcessed) {
      errors.push(
        `chunk[${idx}].linesProcessed regressed: intended=${intendedChunk.linesProcessed} verified=${verifiedChunk.linesProcessed}`
      );
    }

    // Check lines array length regression
    const intendedLinesLen = intendedChunk.lines?.length ?? 0;
    const verifiedLinesLen = verifiedChunk.lines?.length ?? 0;
    if (verifiedLinesLen < intendedLinesLen) {
      errors.push(
        `chunk[${idx}].lines.length regressed: intended=${intendedLinesLen} verified=${verifiedLinesLen}`
      );
    }

    // Check status regression (completed -> non-completed is a regression)
    if (
      intendedChunk.status === "completed" &&
      verifiedChunk.status !== "completed"
    ) {
      errors.push(
        `chunk[${idx}].status regressed: intended=${intendedChunk.status} verified=${verifiedChunk.status}`
      );
    }
  }

  if (errors.length > 0) {
    return (
      `[MONOTONICITY_VIOLATION] threadId=${threadId} ` +
      `intendedVersion=${intended.version} verifiedVersion=${verified.version} ` +
      `errors=[${errors.join("; ")}]`
    );
  }

  return null;
}

async function mutateTranslationJob(
  threadId: string,
  updater: JobUpdater,
  maxAttempts = 3,
  instrumentation?: TickInstrumentation
): Promise<TranslationJobState | null> {
  // ISS-016: Instrument DB update retry telemetry
  const retryTelemetry = instrumentation?.retries
    ? createRetryTelemetryCollector({ retries: instrumentation.retries })
    : noOpRetryTelemetry;
  
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptStart = Date.now();
    const state = await fetchThreadState(threadId);
    const current = state.translation_job;

    if (!current) {
      return null;
    }

    const jobClone: TranslationJobState = structuredClone(current);
    const updated = updater(jobClone);

    if (!updated) {
      return current;
    }

    // ✅ DIAGNOSTIC: Log lines array state before persistence
    console.log("[mutateTranslationJob] BEFORE writeThreadState:");
    console.log(`  job.status=${updated.status}, job.queue=[${updated.queue.join(", ")}], job.active=[${updated.active.join(", ")}]`);
    Object.entries(updated.chunks || {}).forEach(([idx, chunk]) => {
      console.log(
        `  Chunk ${idx}: status=${chunk.status}, linesProcessed=${chunk.linesProcessed}, totalLines=${chunk.totalLines}, lines=${chunk.lines ? `${chunk.lines.length} (defined)` : "undefined"}`
      );
    });

    updated.version = current.version + 1;
    updated.updatedAt = Date.now();
    updated.processing_status = computeProcessingStatus(updated);
    const nextState: ThreadState = {
      ...state,
      translation_job: updated,
    };

    try {
      await writeThreadState(threadId, nextState, current.version);

      // ✅ DIAGNOSTIC: Verify lines array after persistence by re-reading from DB
      const verified = await fetchThreadState(threadId);
      const verifiedJob = verified.translation_job;
      console.log("[mutateTranslationJob] AFTER writeThreadState (verified from DB):");
      console.log(`  job.status=${verifiedJob?.status ?? "null"}, job.queue=[${verifiedJob?.queue.join(", ") ?? "[]"}], job.active=[${verifiedJob?.active.join(", ") ?? "[]"}]`);
      Object.entries(verifiedJob?.chunks || {}).forEach(([idx, chunk]) => {
        console.log(
          `  Chunk ${idx}: status=${chunk.status}, linesProcessed=${chunk.linesProcessed}, totalLines=${chunk.totalLines}, lines=${chunk.lines ? `${chunk.lines.length} (defined)` : "undefined"}`
        );
      });

      // ✅ CRITICAL: Monotonicity check - detect state regressions
      const regressionError = checkMonotonicity(updated, verifiedJob, threadId);
      if (regressionError) {
        console.error(regressionError);

        // In dev, throw to surface the issue immediately
        if (
          process.env.NODE_ENV === "development" ||
          process.env.DEBUG_MONOTONICITY === "1"
        ) {
          throw new Error(regressionError);
        }

        // In production, log but continue (state is already written, can't undo)
        // The reconciliation logic in runTranslationTick should recover
      }

      return updated;
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("concurrently")) {
        const attemptDuration = Date.now() - attemptStart;
        // ISS-016: Record DB update retry
        retryTelemetry.recordRetry({
          layer: "db_update",
          operation: `update_job_${threadId.slice(0, 8)}`,
          attempt: attempt + 1,
          maxAttempts,
          reason: "Concurrent modification",
          elapsedMs: attemptDuration,
        });
        
        console.warn(
          `[mutateTranslationJob] Retry ${attempt + 1}/${maxAttempts} due to concurrent modification`
        );
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `[jobState] Failed to update translation job for ${threadId} after ${maxAttempts} attempts`
  );
}

export async function updateTranslationJob(
  threadId: string,
  updater: JobUpdater
): Promise<TranslationJobState | null> {
  return mutateTranslationJob(threadId, (job) => {
    const updated = updater(job);
    if (updated) {
      ensureQueuedCapacity(updated);
    }
    return updated;
  });
}

export async function updateStanzaStatus(
  threadId: string,
  stanzaIndex: number,
  update: Partial<TranslationStanzaState>
): Promise<TranslationJobState | null> {
  console.log(
    `[updateStanzaStatus] ENTRY: stanzaIndex=${stanzaIndex}, update keys:`,
    Object.keys(update)
  );
  console.log(
    `[updateStanzaStatus] update.lines length:`,
    update.lines?.length ?? "undefined"
  );

  return mutateTranslationJob(threadId, (job) => {
    const chunkOrStanzaStates = job.chunks || job.stanzas || {};
    const stanza = chunkOrStanzaStates[stanzaIndex];
    if (!stanza) {
      console.warn(`[updateStanzaStatus] Stanza ${stanzaIndex} not found!`);
      return job;
    }

    console.log(
      `[updateStanzaStatus] BEFORE: stanza.lines length:`,
      stanza.lines?.length ?? "undefined"
    );

    // Update both chunks and stanzas for backward compatibility
    if (job.chunks) {
      // ✅ FIX: Preserve lines array invariant - ensure it always exists
      const updated = {
        ...stanza,
        ...update,
        chunkIndex: stanzaIndex,
        // Ensure lines array exists (never replace with undefined)
        lines: update.lines ?? stanza.lines ?? [],
      } as TranslationChunkState;

      console.log(
        `[updateStanzaStatus] AFTER chunks merge: lines length:`,
        updated.lines?.length ?? "undefined"
      );
      job.chunks[stanzaIndex] = updated;
    }

    if (job.stanzas) {
      const updated = {
        ...stanza,
        ...update,
        stanzaIndex: stanzaIndex,
      };

      console.log(
        `[updateStanzaStatus] AFTER stanzas merge: lines length:`,
        updated.lines?.length ?? "undefined"
      );
      job.stanzas[stanzaIndex] = updated;
    }

    return job;
  });
}

/**
 * ISS-003: Update a single translated line in a stanza (safe for out-of-order completion)
 * Merges the line by line_number, preserving existing lines and updating linesProcessed correctly
 */
export async function updateSingleLine(
  threadId: string,
  stanzaIndex: number,
  lineData: import("@/types/translationJob").TranslatedLine
): Promise<TranslationJobState | null> {
  return mutateTranslationJob(threadId, (job) => {
    const chunkOrStanzaStates = job.chunks || job.stanzas || {};
    const stanza = chunkOrStanzaStates[stanzaIndex];
    if (!stanza) {
      console.warn(`[updateSingleLine] Stanza ${stanzaIndex} not found!`);
      return job;
    }

    // Ensure lines array exists
    const existingLines = stanza.lines || [];
    
    // Find existing line by line_number
    const lineIndex = existingLines.findIndex(
      (line) => line.line_number === lineData.line_number
    );

    // Merge: update existing line or append new one
    const updatedLines = [...existingLines];
    if (lineIndex >= 0) {
      // Update existing line (idempotent - safe for retries)
      updatedLines[lineIndex] = lineData;
    } else {
      // Append new line (out-of-order completion)
      updatedLines.push(lineData);
      // Sort by line_number to maintain order (for UI display)
      updatedLines.sort((a, b) => a.line_number - b.line_number);
    }

    // ISS-003: Compute linesProcessed from actual completed lines (not sequential index)
    const linesProcessed = updatedLines.filter(
      (line) =>
        line.translationStatus === "translated" ||
        line.translationStatus === "failed"
    ).length;

    // Update stanza with merged lines and correct linesProcessed
    const updatedStanza = {
      ...stanza,
      lines: updatedLines,
      linesProcessed,
      lastLineTranslated: Math.max(
        ...updatedLines
          .filter((l) => l.translationStatus === "translated")
          .map((l) => l.line_number),
        stanza.lastLineTranslated ?? -1
      ),
    };

    // Update both chunks and stanzas
    if (job.chunks) {
      job.chunks[stanzaIndex] = {
        ...updatedStanza,
        chunkIndex: stanzaIndex,
      } as TranslationChunkState;
    }

    if (job.stanzas) {
      job.stanzas[stanzaIndex] = {
        ...updatedStanza,
        stanzaIndex: stanzaIndex,
      };
    }

    return job;
  });
}

/**
 * Update alignment for a specific line in a stanza
 * Used by alignment worker to add word-level alignments after text is finalized
 */
export async function updateLineAlignment(
  threadId: string,
  stanzaIndex: number,
  lineIndex: number,
  alignments: Array<
    Array<{
      original: string;
      translation: string;
      partOfSpeech: string;
      position: number;
    }>
  >,
  alignmentStatus: "ready" | "failed" = "ready"
): Promise<TranslationJobState | null> {
  const finalAlignmentStatus: "aligned" | "failed" =
    alignmentStatus === "ready" ? "aligned" : "failed";

  return mutateTranslationJob(threadId, (job) => {
    const chunkOrStanzaStates = job.chunks || job.stanzas || {};
    const stanza = chunkOrStanzaStates[stanzaIndex];
    if (!stanza || !stanza.lines) {
      return job;
    }

    // Find and update the specific line
    const lineIndexInStanza = stanza.lines.findIndex(
      (line) => line.line_number === lineIndex
    );

    if (lineIndexInStanza === -1) {
      console.warn(
        `[updateLineAlignment] Line ${lineIndex} not found in stanza ${stanzaIndex}`
      );
      return job;
    }

    // Update the line with alignments
    const updatedLines = [...stanza.lines];
    const line = updatedLines[lineIndexInStanza];

    // Update translations with alignments
    const updatedTranslations = line.translations.map((translation, idx) => ({
      ...translation,
      words: alignments[idx] || [],
    }));

    // Update alignmentStatus (translationStatus doesn't change)
    updatedLines[lineIndexInStanza] = {
      ...line,
      translations: updatedTranslations,
      alignmentStatus: finalAlignmentStatus,
      updated_at: Date.now(),
    };

    // Update stanza with new lines array
    const updatedStanza = {
      ...stanza,
      lines: updatedLines,
    };

    // Update both chunks and stanzas
    if (job.chunks) {
      job.chunks[stanzaIndex] = {
        ...updatedStanza,
        chunkIndex: stanzaIndex,
      } as TranslationChunkState;
    }

    if (job.stanzas) {
      job.stanzas[stanzaIndex] = {
        ...updatedStanza,
        stanzaIndex: stanzaIndex,
      };
    }

    return job;
  });
}

export function getNextStanzasToProcess(job: TranslationJobState): number[] {
  ensureQueuedCapacity(job);

  if (job.status === "completed" || job.status === "failed") {
    return [];
  }

  const availableSlots = Math.max(0, job.maxConcurrent - job.active.length);
  if (availableSlots <= 0) {
    return [];
  }

  const chunkOrStanzaStates = job.chunks || job.stanzas || {};
  const queued = job.queue.filter(
    (index) =>
      chunkOrStanzaStates[index]?.status === "queued" ||
      chunkOrStanzaStates[index]?.status === "pending"
  );

  const maxPerTick = job.maxChunksPerTick ?? job.maxStanzasPerTick ?? 2;
  return queued.slice(0, Math.min(availableSlots, maxPerTick));
}

export function markJobCompletedIfDone(
  job: TranslationJobState
): TranslationJobState {
  const chunkOrStanzaStates = job.chunks || job.stanzas || {};

  // Check chunk-level completion
  const hasPendingChunks = Object.values(chunkOrStanzaStates).some(
    (stanza) => stanza.status !== "completed" && stanza.status !== "failed"
  );

  // ✅ CRITICAL FIX: Validate line-level completion
  // A chunk marked "completed" MUST have all its lines properly completed
  const hasIncompleteLines = Object.values(chunkOrStanzaStates).some(
    (stanza) => {
      const lines = stanza.lines || [];
      if (lines.length === 0) {
        // Empty chunk with no lines - check if it should have lines
        // If chunk says it has totalLines but no lines array, it's incomplete
        if (stanza.totalLines > 0) {
          const chunkState = stanza as TranslationChunkState;
          const stanzaState = stanza as unknown as TranslationStanzaState;
          const index =
            chunkState.chunkIndex ?? stanzaState.stanzaIndex ?? "unknown";
          console.warn(
            `[markJobCompletedIfDone] Chunk ${index} has totalLines=${stanza.totalLines} but no lines array`
          );
          return true; // Incomplete
        }
        return false; // Truly empty chunk is ok
      }

      // Check if ANY line is still pending or missing translationStatus
      const incompleteLines = lines.filter(
        (line) =>
          !line.translationStatus || // Missing status
          line.translationStatus === "pending" // Still pending
      );

      if (incompleteLines.length > 0) {
        const chunkState = stanza as TranslationChunkState;
        const stanzaState = stanza as unknown as TranslationStanzaState;
        const index =
          chunkState.chunkIndex ?? stanzaState.stanzaIndex ?? "unknown";
        console.warn(
          `[markJobCompletedIfDone] Chunk ${index} (status: ${stanza.status}) has ${incompleteLines.length} incomplete lines:`,
          incompleteLines.map((l) => ({
            line_number: l.line_number,
            status: l.translationStatus,
            hasTranslations: (l.translations?.length ?? 0) > 0,
          }))
        );
        return true; // Has incomplete lines
      }

      return false;
    }
  );

  // ✅ FIX: Make hasActiveWork robust - don't rely only on arrays
  // Also check for chunks with status="processing" and incomplete (handles array drift)
  const hasActiveWorkFromArrays = job.active.length > 0 || job.queue.length > 0;
  const hasActiveWorkFromChunks = Object.values(chunkOrStanzaStates).some(
    (stanza) =>
      stanza.status === "processing" &&
      stanza.linesProcessed < stanza.totalLines
  );
  const hasActiveWork = hasActiveWorkFromArrays || hasActiveWorkFromChunks;

  if (!hasPendingChunks && !hasIncompleteLines && !hasActiveWork) {
    job.status = "completed";
    job.queue = [];
    console.log(
      `[markJobCompletedIfDone] Job completed: all chunks done, no incomplete lines, no active work`
    );
  } else {
    // Debug: why job is not complete
    if (hasPendingChunks || hasIncompleteLines || hasActiveWork) {
      console.log(
        `[markJobCompletedIfDone] Job NOT complete: hasPendingChunks=${hasPendingChunks}, hasIncompleteLines=${hasIncompleteLines}, hasActiveWork=${hasActiveWork} (active=${job.active.length}, queue=${job.queue.length})`
      );
    }
  }

  return job;
}

export function mergeTickResult(
  job: TranslationJobState,
  result: TranslationTickResult
): TranslationJobState {
  // Use completedChunks if available, otherwise fall back to completedStanzas for backward compatibility
  const completedIndices =
    result.completedChunks ?? result.completedStanzas ?? [];
  job.active = job.active.filter((index) => !completedIndices.includes(index));

  if (!result.hasWorkRemaining && job.active.length === 0) {
    job.status = "completed";
    job.completedAt = Date.now();
    if (job.startedAt) {
      job.processingTimeMs = job.completedAt - job.startedAt;
    }
  } else if (job.status === "pending") {
    job.status = "processing";
  }

  // Update processing status aggregates
  job.processing_status = computeProcessingStatus(job);
  job.updatedAt = Date.now();
  return job;
}

/**
 * Export for use in other modules
 */
export { computeProcessingStatus };
