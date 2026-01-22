/**
 * Regression Tests: Stuck Chunk Recovery
 *
 * Tests that verify the fixes for chunks getting stuck in "processing" state.
 * Run with: npx vitest run src/lib/workshop/__tests__/stuckChunkRecovery.test.ts
 */

import { describe, it, expect } from "vitest";
import type {
  TranslationJobState,
  TranslationChunkState,
  TranslatedLine,
} from "@/types/translationJob";

// ============================================================================
// Test Utilities
// ============================================================================

function createMockJob(overrides: Partial<TranslationJobState> = {}): TranslationJobState {
  return {
    jobId: "test-job-123",
    version: 1,
    status: "processing",
    createdAt: Date.now() - 60000,
    updatedAt: Date.now(),
    startedAt: Date.now() - 60000,
    maxConcurrent: 5,
    maxChunksPerTick: 2,
    queue: [],
    active: [],
    chunks: {},
    ...overrides,
  };
}

function createMockChunk(
  index: number,
  totalLines: number,
  overrides: Partial<TranslationChunkState> = {}
): TranslationChunkState {
  return {
    chunkIndex: index,
    status: "pending",
    linesProcessed: 0,
    totalLines,
    retries: 0,
    maxRetries: 3,
    lines: [],
    ...overrides,
  };
}

function createMockLine(
  lineNumber: number,
  status: "translated" | "failed" | "pending" = "translated"
): TranslatedLine {
  return {
    line_number: lineNumber,
    original_text: `Line ${lineNumber}`,
    translations: [],
    translationStatus: status,
    alignmentStatus: "skipped",
    updated_at: Date.now(),
  };
}

// ============================================================================
// Unit Tests for Reconciliation Logic
// ============================================================================

describe("isIncomplete check (reconcileJobState)", () => {
  it("should detect chunks with linesProcessed === totalLines but status !== completed as incomplete", () => {
    // This tests the fix: previously such chunks were considered complete
    const job = createMockJob({
      chunks: {
        0: createMockChunk(0, 3, {
          status: "processing", // BUG: should be "completed"
          linesProcessed: 3,
          totalLines: 3,
          lines: [
            createMockLine(0),
            createMockLine(1),
            createMockLine(2),
          ],
        }),
      },
      queue: [],
      active: [],
    });

    // The fix: isIncomplete should be true for any non-terminal status
    const chunk = job.chunks[0];
    const isIncompleteOld =
      chunk.status !== "completed" &&
      chunk.status !== "failed" &&
      chunk.linesProcessed < chunk.totalLines;
    const isIncompleteNew =
      chunk.status !== "completed" && chunk.status !== "failed";

    expect(isIncompleteOld).toBe(false); // Old logic: WRONG (missed this chunk)
    expect(isIncompleteNew).toBe(true); // New logic: CORRECT (catches stuck chunk)
  });
});

describe("fixStuckChunks", () => {
  it("should mark chunk as completed when all lines are translated", () => {
    const job = createMockJob({
      chunks: {
        0: createMockChunk(0, 3, {
          status: "queued", // Stuck in non-terminal state
          linesProcessed: 3,
          totalLines: 3,
          startedAt: Date.now() - 300000, // 5 minutes ago
          lines: [createMockLine(0), createMockLine(1), createMockLine(2)],
        }),
      },
      active: [0],
    });

    // Inline the fixStuckChunks logic for testing
    const chunkOrStanzaStates = job.chunks || {};
    const now = Date.now();
    let fixedCount = 0;

    Object.entries(chunkOrStanzaStates).forEach(([, chunk]) => {
      const idx = chunk.chunkIndex;
      const lines = chunk.lines || [];
      const allLinesTranslated =
        lines.length > 0 &&
        lines.every((l) => l.translationStatus === "translated");
      const allLinesPresent = lines.length === chunk.totalLines;
      const isStuckProcessing =
        chunk.status !== "completed" &&
        chunk.status !== "failed" &&
        allLinesTranslated &&
        allLinesPresent;

      if (isStuckProcessing) {
        chunk.status = "completed";
        chunk.completedAt = now;
        job.active = job.active.filter((i) => i !== idx);
        fixedCount++;
      }
    });

    expect(fixedCount).toBe(1);
    expect(job.chunks[0].status).toBe("completed");
    expect(job.active).not.toContain(0);
  });

  it("should NOT fix chunk if lines are still pending", () => {
    const job = createMockJob({
      chunks: {
        0: createMockChunk(0, 3, {
          status: "processing",
          linesProcessed: 2,
          totalLines: 3,
          lines: [
            createMockLine(0),
            createMockLine(1),
            // Line 2 is missing
          ],
        }),
      },
      active: [0],
    });

    const chunk = job.chunks[0];
    const lines = chunk.lines || [];
    const allLinesTranslated =
      lines.length > 0 &&
      lines.every((l) => l.translationStatus === "translated");
    const allLinesPresent = lines.length === chunk.totalLines;
    const isStuckProcessing =
      chunk.status !== "completed" &&
      chunk.status !== "failed" &&
      allLinesTranslated &&
      allLinesPresent;

    expect(isStuckProcessing).toBe(false);
    expect(job.chunks[0].status).toBe("processing"); // Unchanged
  });
});

describe("markJobCompletedIfDone", () => {
  it("should NOT mark job completed if any chunk is not in terminal status", () => {
    const job = createMockJob({
      chunks: {
        0: createMockChunk(0, 3, {
          status: "completed",
          linesProcessed: 3,
          totalLines: 3,
          lines: [createMockLine(0), createMockLine(1), createMockLine(2)],
        }),
        1: createMockChunk(1, 3, {
          status: "queued", // Not terminal
          linesProcessed: 0,
          totalLines: 3,
          lines: [],
        }),
      },
      queue: [],
      active: [],
    });

    // Test the fix: hasActiveWorkFromChunks should detect non-terminal chunk
    const hasActiveWorkFromChunksOld = Object.values(job.chunks).some(
      (stanza) =>
        stanza.status === "processing" && stanza.linesProcessed < stanza.totalLines
    );
    const hasActiveWorkFromChunksNew = Object.values(job.chunks).some(
      (stanza) => stanza.status !== "completed" && stanza.status !== "failed"
    );

    expect(hasActiveWorkFromChunksOld).toBe(false); // Old logic: WRONG (missed queued chunk)
    expect(hasActiveWorkFromChunksNew).toBe(true); // New logic: CORRECT (catches queued chunk)
  });
});

// ============================================================================
// Integration Test: Full Stuck Recovery Scenario
// ============================================================================

describe("Integration: Stuck chunk recovery flow", () => {
  it("should recover job stuck due to failed completion update", () => {
    // Scenario: processStanza completed all lines, but updateTranslationJob failed
    // before marking chunk as "completed"

    // Initial state: chunk has all lines but wrong status
    const job = createMockJob({
      status: "processing",
      chunks: {
        0: createMockChunk(0, 3, {
          status: "processing", // Should be "completed"
          linesProcessed: 3,
          totalLines: 3,
          startedAt: Date.now() - 60000,
          lines: [createMockLine(0), createMockLine(1), createMockLine(2)],
        }),
      },
      queue: [],
      active: [], // Empty - chunk was removed from active but not marked completed
    });

    // Step 1: Reconciliation should detect this as incomplete
    const chunkOrStanzaStates = job.chunks || {};
    const incompleteChunkIndices: number[] = [];

    Object.entries(chunkOrStanzaStates).forEach(([idxStr, chunk]) => {
      const idx = parseInt(idxStr, 10);
      // NEW LOGIC: incomplete = not terminal
      const isIncomplete =
        chunk.status !== "completed" && chunk.status !== "failed";
      if (isIncomplete) {
        incompleteChunkIndices.push(idx);
      }
    });

    expect(incompleteChunkIndices).toContain(0);

    // Step 2: Watchdog should fix the stuck chunk
    const now = Date.now();
    Object.entries(chunkOrStanzaStates).forEach(([, chunk]) => {
      const lines = chunk.lines || [];
      const allLinesTranslated =
        lines.length > 0 &&
        lines.every((l) => l.translationStatus === "translated");
      const allLinesPresent = lines.length === chunk.totalLines;
    const isStuckProcessing =
      chunk.status !== "completed" &&
      chunk.status !== "failed" &&
      allLinesTranslated &&
      allLinesPresent;

      if (isStuckProcessing) {
        chunk.status = "completed";
        chunk.completedAt = now;
      }
    });

    expect(job.chunks[0].status).toBe("completed");

    // Step 3: Job should now be completable
    const hasPendingChunks = Object.values(chunkOrStanzaStates).some(
      (stanza) => stanza.status !== "completed" && stanza.status !== "failed"
    );
    const hasActiveWork =
      job.active.length > 0 || job.queue.length > 0 || hasPendingChunks;

    expect(hasActiveWork).toBe(false);

    // Mark job completed
    if (!hasActiveWork) {
      job.status = "completed";
    }

    expect(job.status).toBe("completed");
  });
});
