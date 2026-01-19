/**
 * Tests for runTranslationTick fixes:
 * 1. Retryable errors should keep stanzas queued (not failed)
 * 2. Per-thread tick lock prevents overlapping ticks
 *
 * NOTE: These are minimal unit-style tests. For full integration tests,
 * see the verification steps in METHOD2_PIPELINE_INVESTIGATION_REPORT.md
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTranslationTick } from "./runTranslationTick";
import { lockHelper } from "@/lib/ai/cache";
import * as jobState from "./jobState";
import * as processStanza from "./processStanza";

// Mock dependencies
vi.mock("@/lib/ai/cache");
vi.mock("./jobState");
vi.mock("./processStanza");

describe("runTranslationTick - Retryable Error Handling (Part 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not mark stanza as failed when error is retryable", async () => {
    const mockThreadId = "test-thread-id";
    const mockLockToken = "mock-lock-token";

    // Mock lock acquisition
    vi.mocked(lockHelper.acquire).mockResolvedValue(mockLockToken);
    vi.mocked(lockHelper.release).mockResolvedValue(undefined);

    // Mock job state
    const mockJob = {
      jobId: "test-job",
      version: 1,
      status: "processing" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      maxConcurrent: 2,
      maxChunksPerTick: 2,
      queue: [0],
      active: [],
      chunks: {
        0: {
          chunkIndex: 0,
          status: "queued" as const,
          linesProcessed: 0,
          totalLines: 2,
          lines: [],
        },
      },
    };

    vi.mocked(jobState.getTranslationJob).mockResolvedValue(mockJob);
    vi.mocked(jobState.updateTranslationJob).mockImplementation(
      async (threadId, updater) => {
        const updated = updater(structuredClone(mockJob));
        return updated || mockJob;
      }
    );

    // Mock loadThreadContext and processStanza
    const mockContext = {
      guideAnswers: {},
      rawPoem: "test poem",
      stanzaResult: {
        stanzas: [
          {
            number: 0,
            text: "test",
            lines: ["line 1", "line 2"],
            lineCount: 2,
            startLineIndex: 0,
          },
        ],
        totalStanzas: 1,
        detectionMethod: "local" as const,
      },
      sourceLanguage: "English",
      createdBy: "test-user",
      projectId: null,
    };

    vi.mocked(
      require("@/lib/workshop/runTranslationTick").loadThreadContext
    ).mockResolvedValue(mockContext);

    // Mock processStanza to throw retryable error
    const retryableError = new Error("Recipe generation in progress. Please retry.");
    Object.assign(retryableError, { retryable: true });
    vi.mocked(processStanza.processStanza).mockRejectedValue(retryableError);

    // Execute
    const result = await runTranslationTick(mockThreadId);

    // Verify: updateTranslationJob was called with status "queued" (not "failed")
    const updateCalls = vi.mocked(jobState.updateTranslationJob).mock.calls;
    const errorUpdateCall = updateCalls.find((call) => {
      const updater = call[1];
      const testJob = structuredClone(mockJob);
      const updated = updater(testJob);
      return updated?.chunks?.[0]?.status === "queued";
    });

    expect(errorUpdateCall).toBeDefined();
    expect(lockHelper.release).toHaveBeenCalledWith(
      `tick:${mockThreadId}`,
      mockLockToken
    );
  });

  it("should mark stanza as failed when error is NOT retryable", async () => {
    const mockThreadId = "test-thread-id";
    const mockLockToken = "mock-lock-token";

    vi.mocked(lockHelper.acquire).mockResolvedValue(mockLockToken);
    vi.mocked(lockHelper.release).mockResolvedValue(undefined);

    const mockJob = {
      jobId: "test-job",
      version: 1,
      status: "processing" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      maxConcurrent: 2,
      maxChunksPerTick: 2,
      queue: [0],
      active: [],
      chunks: {
        0: {
          chunkIndex: 0,
          status: "queued" as const,
          linesProcessed: 0,
          totalLines: 2,
          lines: [],
        },
      },
    };

    vi.mocked(jobState.getTranslationJob).mockResolvedValue(mockJob);
    vi.mocked(jobState.updateTranslationJob).mockImplementation(
      async (threadId, updater) => {
        const updated = updater(structuredClone(mockJob));
        return updated || mockJob;
      }
    );

    const mockContext = {
      guideAnswers: {},
      rawPoem: "test poem",
      stanzaResult: {
        stanzas: [
          {
            number: 0,
            text: "test",
            lines: ["line 1"],
            lineCount: 1,
            startLineIndex: 0,
          },
        ],
        totalStanzas: 1,
        detectionMethod: "local" as const,
      },
      sourceLanguage: "English",
      createdBy: "test-user",
      projectId: null,
    };

    vi.mocked(
      require("@/lib/workshop/runTranslationTick").loadThreadContext
    ).mockResolvedValue(mockContext);

    // Mock processStanza to throw non-retryable error
    const nonRetryableError = new Error("Validation error: invalid format");
    Object.assign(nonRetryableError, { retryable: false });
    vi.mocked(processStanza.processStanza).mockRejectedValue(nonRetryableError);

    // Execute
    await runTranslationTick(mockThreadId);

    // Verify: updateTranslationJob was called with status "failed"
    const updateCalls = vi.mocked(jobState.updateTranslationJob).mock.calls;
    const errorUpdateCall = updateCalls.find((call) => {
      const updater = call[1];
      const testJob = structuredClone(mockJob);
      const updated = updater(testJob);
      return updated?.chunks?.[0]?.status === "failed";
    });

    expect(errorUpdateCall).toBeDefined();
  });
});

describe("runTranslationTick - Per-Thread Tick Lock (Part 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip tick if lock cannot be acquired", async () => {
    const mockThreadId = "test-thread-id";

    // Mock lock acquisition failure (already locked)
    vi.mocked(lockHelper.acquire).mockResolvedValue(null);

    // Execute
    const result = await runTranslationTick(mockThreadId);

    // Verify: returns null immediately, doesn't process
    expect(result).toBeNull();
    expect(lockHelper.acquire).toHaveBeenCalledWith(`tick:${mockThreadId}`, 60);
    expect(lockHelper.release).not.toHaveBeenCalled();
    expect(jobState.getTranslationJob).not.toHaveBeenCalled();
  });

  it("should release lock in finally block even if error occurs", async () => {
    const mockThreadId = "test-thread-id";
    const mockLockToken = "mock-lock-token";

    vi.mocked(lockHelper.acquire).mockResolvedValue(mockLockToken);
    vi.mocked(lockHelper.release).mockResolvedValue(undefined);

    // Mock jobState to throw error
    vi.mocked(jobState.getTranslationJob).mockRejectedValue(
      new Error("DB error")
    );

    // Execute - should throw but release lock
    try {
      await runTranslationTick(mockThreadId);
      expect.fail("Should have thrown");
    } catch (error) {
      // Expected to throw
    }

    // Verify: lock was released in finally
    expect(lockHelper.release).toHaveBeenCalledWith(
      `tick:${mockThreadId}`,
      mockLockToken
    );
  });
});

/**
 * DEV VERIFICATION STEPS (run manually):
 *
 * 1. Test retryable error handling:
 *    - Trigger recipe generation contention (multiple requests to same thread)
 *    - Check logs: stanza should be marked "queued" (not "failed")
 *    - Verify: `[runTranslationTick] Failed to process stanza` log shows status="queued"
 *
 * 2. Test tick lock:
 *    - Open two browser tabs with same threadId
 *    - Both poll /translation-status?advance=true simultaneously
 *    - Check logs: one should show "Tick already in progress, skipping"
 *    - Verify: only one tick processes stanzas at a time
 *
 * 3. Test GPT-5 regen parallelization:
 *    - Set translationRangeMode to "adventurous" (K=6)
 *    - Trigger regen for a line
 *    - Check logs: should see multiple `[OAI][INFLIGHT]` entries concurrently
 *    - Verify: regen completes in ~1.5-2min (not 4-5min)
 */
