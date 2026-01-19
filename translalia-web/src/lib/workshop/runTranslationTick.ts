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
import {
  autoRetryFailedLines,
  getFailedLinesStats,
} from "@/lib/workshop/autoRetryFailedLines";
import { lockHelper, startLockHeartbeat } from "@/lib/ai/cache";
import { classifyError } from "@/lib/workshop/processStanza";
import { ConcurrencyLimiter } from "@/lib/workshop/concurrencyLimiter";

export interface RunTranslationTickOptions {
  maxProcessingTimeMs?: number;
  maxStanzasPerTick?: number;
  chunkConcurrency?: number; // ISS-006: Bounded concurrency for stanzas
}

// ✅ C) Instrumentation: Track timing and OpenAI call counts
export interface TickInstrumentation {
  tickStartTime: number;
  chunksProcessed: number;
  linesAdvanced: number;
  openaiCalls: {
    mainGen: number;
    regen: number;
    recipe: number;
  };
  openaiDurations: {
    mainGen: number[];
    regen: number[];
    recipe: number[];
  };
  openaiTokens: {
    mainGen: { prompt: number; completion: number }[];
    regen: { prompt: number; completion: number }[];
    recipe: { prompt: number; completion: number }[];
  };
  retries: {
    attempts: number;
    retries: number;
    totalDelayMs: number;
    lastErrorReason?: string;
    byLayer: Record<string, {
      attempts: number;
      retries: number;
      totalDelayMs: number;
    }>;
  };
  lineTimings: Array<{
    lineIndex: number;
    chunkIndex: number;
    mainGenLatencyMs?: number;
    regenLatencyMs?: number;
    regenAttempts?: number;
    gateResult?: string;
    finalStatus: "translated" | "failed" | "degraded";
  }>;
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

/**
 * Reconciliation step: Rebuild queue/active from chunk states (strong reconciliation).
 * This prevents jobs from getting stuck in "processing" with no scheduled work.
 * 
 * Rules enforced:
 * - If chunk is incomplete and status === "processing" => must be in active
 * - If chunk is incomplete and status !== "processing" => must be in queue
 * - lines must always exist; linesProcessed = lines.length
 * - If queue=[] and active=[] but incomplete chunks exist => seed queue with incomplete chunks
 */
function reconcileJobState(draft: TranslationJobState): void {
  const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
  
  // ✅ Use actual chunk keys, not a count parameter (avoids "chunk 1 never fixed" bugs)
  const chunkIndices = Object.keys(chunkOrStanzaStates).map((k) => parseInt(k, 10));
  const totalChunks = chunkIndices.length > 0 
    ? Math.max(...chunkIndices) + 1 
    : (draft.total_chunks ?? 0);
  
  // Step 1: Ensure every chunk has lines: [] if missing
  // Step 2: Rebuild linesProcessed from lines.length
  const incompleteChunkIndices: number[] = [];
  
  // Iterate through all possible chunk indices (0 to totalChunks-1)
  // This ensures we catch all chunks, not just those with existing state
  for (let idx = 0; idx < totalChunks; idx++) {
    const chunk = chunkOrStanzaStates[idx];
    if (!chunk) {
      continue; // Chunk doesn't exist yet - will be created when processing starts
    }

    // Step 1: Ensure lines array exists
    if (!chunk.lines) {
      chunk.lines = [];
    }

    // Step 2: Rebuild linesProcessed from lines.length (invariant)
    chunk.linesProcessed = chunk.lines.length;

    // Track incomplete chunks
    const isIncomplete =
      chunk.status !== "completed" &&
      chunk.status !== "failed" &&
      chunk.linesProcessed < chunk.totalLines;

    if (isIncomplete) {
      incompleteChunkIndices.push(idx);
    }
  }

  // ✅ REBUILD queue/active from scratch (ignore existing arrays)
  const newQueue: number[] = [];
  const newActive: number[] = [];

  for (const idx of incompleteChunkIndices) {
    const chunk = chunkOrStanzaStates[idx];
    if (!chunk) continue;

    if (chunk.status === "processing") {
      // Incomplete + processing => must be in active
      if (!newActive.includes(idx)) {
        newActive.push(idx);
      }
    } else {
      // Incomplete + not processing => must be in queue
      if (!newQueue.includes(idx)) {
        newQueue.push(idx);
      }
    }
  }

  // If both are empty but incomplete work exists, seed queue with all incomplete chunks (in order)
  if (newQueue.length === 0 && newActive.length === 0 && incompleteChunkIndices.length > 0) {
    newQueue.push(...incompleteChunkIndices);
    console.log(
      `[reconcileJobState] Re-seeded queue with ${incompleteChunkIndices.length} incomplete chunks: [${incompleteChunkIndices.join(", ")}]`
    );
  }

  const queueChanged = 
    draft.queue.length !== newQueue.length ||
    !draft.queue.every((idx, i) => newQueue[i] === idx);
  const activeChanged =
    draft.active.length !== newActive.length ||
    !draft.active.every((idx, i) => newActive[i] === idx);

  if (queueChanged || activeChanged) {
    draft.queue = newQueue;
    draft.active = newActive;
    console.log(
      `[reconcileJobState] RECONCILED: ${incompleteChunkIndices.length} incomplete chunks. Queue: [${draft.queue.join(", ")}], Active: [${draft.active.join(", ")}]`
    );
  }
}

/**
 * Dev-only invariant checker. Validates job state consistency.
 * Logs violations; throws in dev, logs only in prod.
 */
function assertJobInvariants(job: TranslationJobState, context: string): void {
  const isDev = process.env.NODE_ENV === "development" || process.env.DEBUG_INVARIANTS === "1";
  const chunkOrStanzaStates = job.chunks || job.stanzas || {};
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check every chunk has lines array
  Object.entries(chunkOrStanzaStates).forEach(([idxStr, chunk]) => {
    const idx = parseInt(idxStr, 10);
    if (!chunk.lines) {
      errors.push(`Chunk ${idx}: missing lines array`);
    }

    // Check linesProcessed <= lines.length (never greater)
    if (chunk.lines && chunk.linesProcessed > chunk.lines.length) {
      errors.push(
        `Chunk ${idx}: linesProcessed (${chunk.linesProcessed}) > lines.length (${chunk.lines.length})`
      );
    }

    // Check linesProcessed matches lines.length (invariant)
    if (chunk.lines && chunk.linesProcessed !== chunk.lines.length) {
      warnings.push(
        `Chunk ${idx}: linesProcessed (${chunk.linesProcessed}) !== lines.length (${chunk.lines.length})`
      );
    }

    // Check incomplete chunks are in queue/active
    const isIncomplete =
      chunk.status !== "completed" &&
      chunk.status !== "failed" &&
      chunk.linesProcessed < chunk.totalLines;

    if (isIncomplete) {
      if (chunk.status === "processing") {
        if (!job.active.includes(idx)) {
          errors.push(
            `Chunk ${idx}: incomplete + processing but NOT in active array`
          );
        }
      } else {
        if (!job.queue.includes(idx) && !job.active.includes(idx)) {
          errors.push(
            `Chunk ${idx}: incomplete + status="${chunk.status}" but NOT in queue or active`
          );
        }
      }
    }

    // Check complete chunks are NOT in queue/active
    const isComplete = chunk.linesProcessed >= chunk.totalLines;
    if (isComplete || chunk.status === "completed" || chunk.status === "failed") {
      if (job.queue.includes(idx)) {
        warnings.push(`Chunk ${idx}: complete but still in queue`);
      }
      if (job.active.includes(idx)) {
        warnings.push(`Chunk ${idx}: complete but still in active`);
      }
    }
  });

  // Check queue/active have no duplicates
  const queueDuplicates = job.queue.filter(
    (idx, i) => job.queue.indexOf(idx) !== i
  );
  if (queueDuplicates.length > 0) {
    errors.push(`Queue has duplicates: [${queueDuplicates.join(", ")}]`);
  }

  const activeDuplicates = job.active.filter(
    (idx, i) => job.active.indexOf(idx) !== i
  );
  if (activeDuplicates.length > 0) {
    errors.push(`Active has duplicates: [${activeDuplicates.join(", ")}]`);
  }

  // Check queue/active contain only valid indices
  const allChunkIndices = new Set(Object.keys(chunkOrStanzaStates).map((k) => parseInt(k, 10)));
  const invalidQueueIndices = job.queue.filter((idx) => !allChunkIndices.has(idx));
  if (invalidQueueIndices.length > 0) {
    errors.push(`Queue contains invalid indices: [${invalidQueueIndices.join(", ")}]`);
  }

  const invalidActiveIndices = job.active.filter((idx) => !allChunkIndices.has(idx));
  if (invalidActiveIndices.length > 0) {
    errors.push(`Active contains invalid indices: [${invalidActiveIndices.join(", ")}]`);
  }

  // Report results
  if (errors.length > 0 || warnings.length > 0) {
    const prefix = `[assertJobInvariants] ${context}`;
    if (errors.length > 0) {
      const msg = `${prefix} ERRORS: ${errors.join("; ")}`;
      console.error(msg);
      if (isDev) {
        throw new Error(msg);
      }
    }
    if (warnings.length > 0) {
      console.warn(`${prefix} WARNINGS: ${warnings.join("; ")}`);
    }
  }
}

export async function runTranslationTick(
  threadId: string,
  options: RunTranslationTickOptions = {}
): Promise<TranslationTickResult | null> {
  // PART 3 FIX: Per-thread tick lock to prevent overlapping ticks
  // ✅ PRIORITY 3 FIX: Increased TTL from 60s to 600s (10 minutes)
  // Ticks can run for several minutes when processing multiple chunks with OpenAI calls.
  // A 60s TTL was causing lock expiry mid-tick, allowing overlapping ticks.
  const tickKey = `tick:${threadId}`;
  const tickStartTime = Date.now();
  const TICK_LOCK_TTL = 600; // 10 minutes - enough for multi-chunk parallel processing
  const tickLockToken = await lockHelper.acquire(tickKey, TICK_LOCK_TTL);

  if (!tickLockToken) {
    // ✅ D) Clear log when lock is not acquired (tick already running)
    console.log(
      `[runTranslationTick] ⏭️  SKIP: Tick already in progress for ${threadId} ` +
      `(lock key: ${tickKey}, TTL: ${TICK_LOCK_TTL}s). ` +
      `Translation-status polling will not start a new tick if one is already running.`
    );
    return null; // Another tick is running, skip this one
  }

  console.log(
    `[runTranslationTick] 🔒 LOCK ACQUIRED: ${tickKey} (TTL: ${TICK_LOCK_TTL}s, token: ${tickLockToken.slice(0, 8)}...) at ${new Date(tickStartTime).toISOString()}`
  );

  // ✅ CRITICAL FIX: Start heartbeat to prevent lock expiration during long-running ticks
  // The heartbeat extends the lock TTL periodically, preventing overlapping ticks
  // when processing takes longer than the initial TTL.
  const stopHeartbeat = startLockHeartbeat(tickKey, tickLockToken, TICK_LOCK_TTL);

  try {
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
    
    // ✅ RECONCILIATION: Rebuild queue/active from chunk states FIRST (atomic with selection)
    // This ensures getNextStanzasToProcess() can't see pre-reconciled empty queue
    reconcileJobState(draft);
    
    // ✅ INVARIANT CHECK #1: After reconciliation
    assertJobInvariants(draft, "after reconciliation");
    
    const picks = getNextStanzasToProcess(draft);
    
    // ISS-006: Configurable max stanzas per tick (with kill switch)
    // Note: This is computed inside the updater to ensure atomicity with selection
    const parallelStanzasEnabled = process.env.ENABLE_PARALLEL_STANZAS !== "0";
    const maxStanzasPerTickEnv = parallelStanzasEnabled
      ? Math.min(
          Math.max(1, Number(process.env.MAX_STANZAS_PER_TICK) || 1),
          5
        )
      : 1;
    
    const limited = picks.slice(
      0,
      options.maxStanzasPerTick ?? maxStanzasPerTickEnv
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

    // ✅ INVARIANT CHECK #2: After selection and state updates
    assertJobInvariants(draft, "after selection");

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
  const jobChunkOrStanzaStates = updatedJob.chunks || updatedJob.stanzas || {};
  Object.entries(jobChunkOrStanzaStates).forEach(([idx, stanza]) => {
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
  // ✅ B) TIME-SLICING: Strict time budget (default 2500ms for <2s HTTP responses)
  const maxProcessingTime = options.maxProcessingTimeMs ?? 2500;
  const windowStart = Date.now();
  
  // ISS-005: Compute absolute deadline for interruptible processing
  const timeSlicingEnabled = process.env.ENABLE_TICK_TIME_SLICING !== "0";
  const deadlineMs = timeSlicingEnabled ? Date.now() + maxProcessingTime : undefined;

  // ✅ C) Instrumentation: Initialize tracking (before recipe pre-warming)
  const instrumentation: TickInstrumentation = {
    tickStartTime: windowStart,
    chunksProcessed: 0,
    linesAdvanced: 0,
    openaiCalls: { mainGen: 0, regen: 0, recipe: 0 },
    openaiDurations: { mainGen: [], regen: [], recipe: [] },
    openaiTokens: { mainGen: [], regen: [], recipe: [] },
    retries: {
      attempts: 0,
      retries: 0,
      totalDelayMs: 0,
      byLayer: {},
    },
    lineTimings: [],
  };

  // ✅ PRIORITY 3 FIX: Pre-warm recipes before parallel processing
  // This prevents recipe generation contention when multiple chunks start simultaneously.
  // All parallel processStanza() calls will hit cache, avoiding lock waits and retries.
  const { getOrCreateVariantRecipes } = await import("@/lib/ai/variantRecipes");
  const mode = guideAnswers.translationRangeMode ?? "balanced";
  // Extract targetLanguage using same logic as processStanza
  const targetLang = guideAnswers.targetLanguage?.lang?.trim();
  const targetVariety = guideAnswers.targetLanguage?.variety?.trim();
  const targetLanguage = targetLang
    ? `${targetLang}${targetVariety ? ` (${targetVariety})` : ""}`
    : "the target language";
  
  try {
    console.log(
      `[runTranslationTick] Pre-warming recipes for mode=${mode} before parallel processing`
    );
    await getOrCreateVariantRecipes(threadId, guideAnswers, {
      fullPoem: rawPoem,
      sourceLanguage,
      targetLanguage,
    }, mode, instrumentation);
    console.log(
      `[runTranslationTick] Recipes pre-warmed, starting parallel chunk processing`
    );
  } catch (error) {
    // Log but don't fail - recipes will be generated on-demand if pre-warming fails
    console.warn(
      `[runTranslationTick] Recipe pre-warming failed (will generate on-demand):`,
      error instanceof Error ? error.message : String(error)
    );
  }

  // ✅ B) TIME-SLICING: Check budget before starting any work
  // If budget is too small, skip work and return current state
  if (maxProcessingTime < 1000) {
    console.log(
      `[runTranslationTick] Time budget too small (${maxProcessingTime}ms), skipping work`
    );
    const earlyJob = await getTranslationJob(threadId);
    if (!earlyJob) {
      return null;
    }
    return {
      job: earlyJob,
      startedChunks: [],
      startedStanzas: [],
      completedChunks: [],
      completedStanzas: [],
      hasWorkRemaining: true,
    };
  }

  // ISS-006: Bounded concurrency for stanzas
  const parallelStanzasEnabled = process.env.ENABLE_PARALLEL_STANZAS !== "0";
  const chunkConcurrency = parallelStanzasEnabled
    ? Math.min(
        Math.max(1, Number(process.env.CHUNK_CONCURRENCY) || 1),
        3
      )
    : 1;
  
  const stanzaLimiter = new ConcurrencyLimiter(chunkConcurrency);
  
  // ISS-006: Compute maxStanzasPerTick for logging (same logic as in updater)
  const maxStanzasPerTickEnv = parallelStanzasEnabled
    ? Math.min(
        Math.max(1, Number(process.env.MAX_STANZAS_PER_TICK) || 1),
        5
      )
    : 1;

  // Process chunks in parallel with Promise.allSettled
  // Note: With time-slicing, we typically process 1 chunk at a time
  console.log(
    `[runTranslationTick] Processing ${started.length} chunk(s) with ${maxProcessingTime}ms budget ` +
    `(timeSlicing=${timeSlicingEnabled}, deadline=${deadlineMs ? new Date(deadlineMs).toISOString() : "none"}, ` +
    `maxStanzasPerTick=${options.maxStanzasPerTick ?? maxStanzasPerTickEnv}, chunkConcurrency=${chunkConcurrency})`
  );
  
  // ISS-005: Track interruption state
  let anyInterrupted = false;
  
  const processingPromises = started.map(async (stanzaIndex) => {
    // ISS-006: Acquire permit for stanza processing (bounded concurrency)
    const permit = await stanzaLimiter.acquire();
    
    try {
      // ✅ B) TIME-SLICING: Check time budget before starting chunk
      const elapsedBeforeStart = Date.now() - windowStart;
      if (elapsedBeforeStart > maxProcessingTime) {
        console.log(
          `[runTranslationTick] ⏱️  Time budget exceeded (${elapsedBeforeStart}ms > ${maxProcessingTime}ms), skipping chunk ${stanzaIndex}`
        );
        return { stanzaIndex, status: "skipped" as const };
      }

      const stanza = stanzaResult.stanzas[stanzaIndex];
      if (!stanza) {
        return {
          stanzaIndex,
          status: "failed" as const,
          error: new Error("Stanza not found"),
        };
      }

      try {
        // ISS-005: Pass deadline to processStanza for interruptible processing
        // ISS-016/017: Pass instrumentation for retry telemetry and OpenAI call tracking
        const result = await processStanza({
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
          deadlineMs,
          instrumentation,
        });
        
        // ISS-005: Track interruption
        if (result.interrupted) {
          anyInterrupted = true;
          console.log(
            `[runTranslationTick] Stanza ${stanzaIndex} interrupted: ` +
            `${result.linesCompleted}/${result.linesTotal} lines completed`
          );
          // Return interrupted status - stanza will be resumed on next tick
          // Don't mark as completed - keep status as "processing"
          return { stanzaIndex, status: "interrupted" as const, result };
        }

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

            // ✅ CRITICAL FIX: Verify all expected lines are present before marking as completed
            const allLinesPresent = lines.length === stanzaState.totalLines;

            if (allLinesTranslated && allLinesPresent && lines.length > 0) {
              // All lines successfully translated and all lines present in array
              stanzaState.status = "completed";
              stanzaState.completedAt = Date.now();
              stanzaState.linesProcessed = stanzaState.totalLines;
              stanzaState.error = undefined;
              console.log(
                `[runTranslationTick] Chunk ${stanzaIndex} completed: all ${lines.length}/${stanzaState.totalLines} lines translated`
              );
            } else if (allLinesTranslated && !allLinesPresent) {
              // All existing lines are translated, but some lines are missing from the array
              // This should not happen - keep chunk as processing until all lines are stored
              console.warn(
                `[runTranslationTick] Chunk ${stanzaIndex} has all lines translated but missing lines in array: ${lines.length}/${stanzaState.totalLines} lines present. Keeping as processing.`
              );
              stanzaState.status = "processing"; // Don't mark as completed - missing lines
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

        return { stanzaIndex, status: "completed" as const };
      } catch (error: unknown) {
      console.error(
        `[runTranslationTick] Failed to process stanza ${stanzaIndex} for ${threadId}`,
        error
      );

      // PART 2 FIX: Check if error is retryable before marking as failed
      // processStanza may have already set status to "queued" with nextRetryAt
      // We should not overwrite that status with "failed"
      const errorClassification = classifyError(error);
      const isRetryable =
        (error as { retryable?: boolean })?.retryable === true ||
        errorClassification.retryable;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Update job state - only mark as failed if NOT retryable
      await updateTranslationJob(threadId, (draft) => {
        applyMetadata(draft);
        const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
        const stanzaState = chunkOrStanzaStates[stanzaIndex];
        if (stanzaState) {
          // ✅ FIX: Only mark as failed if error is NOT retryable
          // If retryable, status was already set to "queued" by processStanza retry logic
          if (!isRetryable) {
            stanzaState.status = "failed";
            stanzaState.completedAt = Date.now();
            stanzaState.error = errorMessage;
          }
          // If retryable, leave status as "queued" (set by processStanza)
          // Optionally record error for observability without changing status
          if (isRetryable) {
            draft.lastError = errorMessage; // Record for debugging
          }
        }
        if (!isRetryable) {
          draft.lastError = errorMessage;
        }
        draft.active = draft.active.filter((index) => index !== stanzaIndex);
        return draft;
      });

      return {
        stanzaIndex,
        status: isRetryable ? ("queued" as const) : ("failed" as const),
        error,
      };
      }
    } finally {
      // ISS-006: Release permit
      permit.release();
    }
  });

  const results = await Promise.allSettled(processingPromises);

  // Categorize results
  const interrupted: number[] = [];
  results.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      const { stanzaIndex, status } = result.value;
      if (status === "completed") {
        completed.push(stanzaIndex);
      } else if (status === "skipped") {
        skipped.push(stanzaIndex);
      } else if (status === "interrupted") {
        interrupted.push(stanzaIndex);
      } else if (status === "failed") {
        failed.push(stanzaIndex);
      }
    } else {
      // Promise rejected (shouldn't happen with try-catch, but handle it)
      console.error(
        "[runTranslationTick] Unexpected rejection:",
        result.reason
      );
      const stanzaIndex = started[idx];
      if (stanzaIndex !== undefined) {
        failed.push(stanzaIndex);
      }
    }
  });

  console.log(
    `[runTranslationTick] Parallel processing complete: ${completed.length} completed, ` +
    `${failed.length} failed, ${skipped.length} skipped, ${interrupted.length} interrupted`
  );
  
  // ISS-005: Handle interrupted stanzas - keep as "processing" for next tick
  // Reconciliation logic will re-queue them if incomplete
  if (interrupted.length > 0) {
    await updateTranslationJob(threadId, (draft) => {
      applyMetadata(draft);
      interrupted.forEach((index) => {
        const chunkOrStanzaStates = draft.chunks || draft.stanzas || {};
        const stanzaState = chunkOrStanzaStates[index];
        if (stanzaState) {
          // Keep as "processing" so reconciliation picks it up
          stanzaState.status = "processing";
        }
        // Remove from active - reconciliation will re-add if incomplete
        draft.active = draft.active.filter((id) => id !== index);
      });
      return draft;
    });
    
    console.log(
      `[runTranslationTick] Marked ${interrupted.length} interrupted stanza(s) for resumption on next tick`
    );
  }

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

  // ✅ NEW FEATURE: Automatic retry for failed lines
  // Check for failed lines and automatically retry them if eligible
  const failedStats = getFailedLinesStats(finalJob);

  if (failedStats.retryable > 0) {
    console.log(
      `[runTranslationTick] Found ${failedStats.retryable} failed lines eligible for automatic retry`
    );

    try {
      const retryResults = await autoRetryFailedLines(finalJob, {
        threadId,
        stanzaResult,
        rawPoem,
        guideAnswers,
        sourceLanguage,
        auditUserId: createdBy,
        auditProjectId: context.projectId,
        instrumentation,
      });

      if (retryResults.succeeded > 0) {
        console.log(
          `[runTranslationTick] Auto-retry succeeded for ${retryResults.succeeded} lines`
        );

        // Refresh job state after retries
        const refreshedJob = await getTranslationJob(threadId);
        if (refreshedJob) {
          refreshedJob.processing_status =
            computeProcessingStatus(refreshedJob);
          return {
            job: refreshedJob,
            startedChunks: started,
            startedStanzas: started,
            completedChunks: completed,
            completedStanzas: completed,
            hasWorkRemaining: refreshedJob.status !== "completed",
          };
        }
      }
    } catch (error) {
      console.error("[runTranslationTick] Auto-retry failed:", error);
      // Continue with original job state if retry fails
    }
  }

  // Feature 8: Update processing status aggregates
  finalJob.processing_status = computeProcessingStatus(finalJob);

  // ✅ C) INVESTIGATION: End-of-tick summary logging with instrumentation
  const tickDuration = Date.now() - tickStartTime;
  const finalChunkOrStanzaStates = finalJob.chunks || finalJob.stanzas || {};
  
  // ISS-005: Log interruption status
  const wasInterrupted = anyInterrupted || interrupted.length > 0;
  
  // ISS-017: Calculate OpenAI call statistics
  const openaiStats = {
    mainGen: {
      count: instrumentation.openaiCalls.mainGen,
      avgDuration: instrumentation.openaiDurations.mainGen.length > 0
        ? Math.round(instrumentation.openaiDurations.mainGen.reduce((a, b) => a + b, 0) / instrumentation.openaiDurations.mainGen.length)
        : 0,
      totalDuration: instrumentation.openaiDurations.mainGen.reduce((a, b) => a + b, 0),
      totalPromptTokens: instrumentation.openaiTokens.mainGen.reduce((a, b) => a + b.prompt, 0),
      totalCompletionTokens: instrumentation.openaiTokens.mainGen.reduce((a, b) => a + b.completion, 0),
    },
    regen: {
      count: instrumentation.openaiCalls.regen,
      avgDuration: instrumentation.openaiDurations.regen.length > 0
        ? Math.round(instrumentation.openaiDurations.regen.reduce((a, b) => a + b, 0) / instrumentation.openaiDurations.regen.length)
        : 0,
      totalDuration: instrumentation.openaiDurations.regen.reduce((a, b) => a + b, 0),
      totalPromptTokens: instrumentation.openaiTokens.regen.reduce((a, b) => a + b.prompt, 0),
      totalCompletionTokens: instrumentation.openaiTokens.regen.reduce((a, b) => a + b.completion, 0),
    },
    recipe: {
      count: instrumentation.openaiCalls.recipe,
      avgDuration: instrumentation.openaiDurations.recipe.length > 0
        ? Math.round(instrumentation.openaiDurations.recipe.reduce((a, b) => a + b, 0) / instrumentation.openaiDurations.recipe.length)
        : 0,
      totalDuration: instrumentation.openaiDurations.recipe.reduce((a, b) => a + b, 0),
      totalPromptTokens: instrumentation.openaiTokens.recipe.reduce((a, b) => a + b.prompt, 0),
      totalCompletionTokens: instrumentation.openaiTokens.recipe.reduce((a, b) => a + b.completion, 0),
    },
  };

  // ISS-017: Warn if openaiCalls are zero but work was completed
  const totalOpenaiCalls = instrumentation.openaiCalls.mainGen + instrumentation.openaiCalls.regen + instrumentation.openaiCalls.recipe;
  if (totalOpenaiCalls === 0 && (completed.length > 0 || instrumentation.linesAdvanced > 0)) {
    console.warn(
      `[runTranslationTick] ⚠️  WARNING: openaiCalls=0 but work completed (${completed.length} stanzas, ${instrumentation.linesAdvanced} lines). ` +
      `This suggests instrumentation gap - OpenAI calls may not be tracked.`
    );
  }

  // Log compact instrumentation summary
  console.log(
    `[runTranslationTick] 📊 TICK_INSTRUMENTATION: ` +
    JSON.stringify({
      tickDurationMs: tickDuration,
      chunksProcessed: instrumentation.chunksProcessed,
      linesAdvanced: instrumentation.linesAdvanced,
      openaiCalls: instrumentation.openaiCalls,
      openaiStats,
      retries: instrumentation.retries,
      lineCount: instrumentation.lineTimings.length,
      interrupted: wasInterrupted,
      interruptedCount: interrupted.length,
    })
  );
  
  const chunkOrStanzaStates = finalChunkOrStanzaStates;
  const chunkSummary: string[] = [];

  Object.entries(chunkOrStanzaStates).forEach(([idxStr, chunk]) => {
    const idx = parseInt(idxStr, 10);
    const lines = chunk.lines || [];
    const lastLineTranslated = lines
      .filter((l) => l.translationStatus === "translated")
      .map((l) => l.line_number)
      .sort((a, b) => b - a)[0];

    // ✅ Guard: Check for linesProcessed==totalLines but lines.length<totalLines
    if (chunk.linesProcessed === chunk.totalLines && lines.length < chunk.totalLines) {
      const missingIndexes: number[] = [];
      // Find which line numbers are missing
      for (let lineNum = 0; lineNum < chunk.totalLines; lineNum++) {
        const globalLineNum = (lineOffsets[idx] ?? 0) + lineNum;
        const found = lines.some((l) => l.line_number === globalLineNum);
        if (!found) {
          missingIndexes.push(globalLineNum);
        }
      }
      console.error(
        `[runTranslationTick] ⚠️  GUARD TRIGGERED: Chunk ${idx} reports linesProcessed=${chunk.linesProcessed} ` +
        `but lines.length=${lines.length} (missing ${chunk.totalLines - lines.length} lines). ` +
        `Missing line indexes: [${missingIndexes.join(", ")}]`
      );
    }

    chunkSummary.push(
      `chunk[${idx}]: status=${chunk.status} ` +
      `linesProcessed=${chunk.linesProcessed}/${chunk.totalLines} ` +
      `lines.length=${lines.length} ` +
      `lastLine=${lastLineTranslated ?? "none"}`
    );
  });

  console.log(
    `[runTranslationTick] 📊 TICK SUMMARY: duration=${tickDuration}ms ` +
    `active=[${finalJob.active.join(", ")}] queue=[${finalJob.queue.join(", ")}] ` +
    `completed=${completed.length} failed=${failed.length} skipped=${skipped.length} ` +
    `interrupted=${interrupted.length}`
  );
  console.log(
    `[runTranslationTick] 📊 CHUNK DETAILS: ${chunkSummary.join("; ")}`
  );

  return {
    job: finalJob,
    startedChunks: started,
    startedStanzas: started,
    completedChunks: completed,
    completedStanzas: completed,
    hasWorkRemaining: finalJob.status !== "completed",
  };
  } finally {
    // ✅ CRITICAL: Stop heartbeat BEFORE releasing lock
    // This prevents the heartbeat from extending a lock we're about to release
    stopHeartbeat();

    // PART 3 FIX: Release tick lock
    if (tickLockToken) {
      const tickDuration = Date.now() - tickStartTime;
      await lockHelper.release(tickKey, tickLockToken);
      console.log(
        `[runTranslationTick] 🔓 LOCK RELEASED: ${tickKey} after ${tickDuration}ms`
      );
    }
  }
}
