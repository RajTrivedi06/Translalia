import type {
  TranslationChunkState,
  TranslationJobProgressCounts,
  TranslationJobProgressSummary,
  TranslationJobState,
  TranslationStanzaState,
} from "@/types/translationJob";

function cloneChunkState(
  chunk: TranslationChunkState
): TranslationChunkState {
  return { ...chunk };
}

function cloneStanzaState(
  stanza: TranslationStanzaState
): TranslationStanzaState {
  return { ...stanza };
}

export function summarizeTranslationJob(
  job: TranslationJobState | null
): TranslationJobProgressSummary | null {
  if (!job) {
    return null;
  }

  // Use chunks if available, otherwise fall back to stanzas
  const chunkOrStanzaStates = job.chunks || job.stanzas || {};

  const counts: TranslationJobProgressCounts = {
    total: Object.keys(chunkOrStanzaStates).length,
    completed: 0,
    processing: 0,
    queued: 0,
    pending: 0,
    failed: 0,
  };

  Object.values(chunkOrStanzaStates).forEach((stanza) => {
    if (stanza.status === "completed") counts.completed += 1;
    else if (stanza.status === "processing") counts.processing += 1;
    else if (stanza.status === "queued") counts.queued += 1;
    else if (stanza.status === "failed") counts.failed += 1;
    else counts.pending += 1;
  });

  const clonedChunks = Object.fromEntries(
    Object.entries(chunkOrStanzaStates).map(([index, chunk]) => [
      Number(index),
      cloneChunkState(chunk as TranslationChunkState),
    ])
  );

  // For backward compatibility, also provide cloned stanzas (same data)
  const clonedStanzas: Record<number, TranslationStanzaState> = {};
  Object.entries(chunkOrStanzaStates).forEach(([index, state]) => {
    clonedStanzas[Number(index)] = {
      stanzaIndex: (state as any).stanzaIndex ?? Number(index),
      status: state.status,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      error: state.error,
      error_details: state.error_details,
      linesProcessed: state.linesProcessed,
      totalLines: state.totalLines,
      lastLineTranslated: state.lastLineTranslated,
      retries: state.retries,
      maxRetries: state.maxRetries,
      nextRetryAt: state.nextRetryAt,
      error_history: state.error_history,
      lines: state.lines,
      fallback_mode: state.fallback_mode,
    };
  });

  return {
    jobId: job.jobId,
    status: job.status,
    progress: counts,
    chunks: clonedChunks,
    stanzas: clonedStanzas,
    updatedAt: job.updatedAt,
  };
}
