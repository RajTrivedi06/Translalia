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

async function writeThreadState(
  threadId: string,
  state: ThreadState,
  previousVersion?: number
): Promise<void> {
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

async function mutateTranslationJob(
  threadId: string,
  updater: JobUpdater,
  maxAttempts = 3
): Promise<TranslationJobState | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
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

    updated.version = current.version + 1;
    updated.updatedAt = Date.now();
    updated.processing_status = computeProcessingStatus(updated);
    const nextState: ThreadState = {
      ...state,
      translation_job: updated,
    };

    try {
      await writeThreadState(threadId, nextState, current.version);
      return updated;
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("concurrently")) {
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
  return mutateTranslationJob(threadId, (job) => {
    const chunkOrStanzaStates = job.chunks || job.stanzas || {};
    const stanza = chunkOrStanzaStates[stanzaIndex];
    if (!stanza) {
      return job;
    }

    // Update both chunks and stanzas for backward compatibility
    if (job.chunks) {
      job.chunks[stanzaIndex] = {
        ...stanza,
        ...update,
        chunkIndex: stanzaIndex,
      } as TranslationChunkState;
    }

    if (job.stanzas) {
      job.stanzas[stanzaIndex] = {
        ...stanza,
        ...update,
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
          console.warn(
            `[markJobCompletedIfDone] Chunk ${stanza.chunkIndex ?? stanza.stanzaIndex} has totalLines=${stanza.totalLines} but no lines array`
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
        console.warn(
          `[markJobCompletedIfDone] Chunk ${stanza.chunkIndex ?? stanza.stanzaIndex} (status: ${stanza.status}) has ${incompleteLines.length} incomplete lines:`,
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

  // ✅ NEW: Check if all chunks are either completed or failed (no processing/queued)
  const hasActiveWork = job.active.length > 0 || job.queue.length > 0;

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
