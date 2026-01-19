/**
 * Regression Test: Concurrent Audit Writes
 *
 * This test verifies that audit writes do NOT clobber translation_job state.
 * It simulates the race condition that caused "missing lines" bugs.
 *
 * Run with: npx tsx src/lib/workshop/concurrentAuditTest.ts
 *
 * Prerequisites:
 * - Supabase running with exec_sql and append_method2_audit RPCs
 * - Valid auth credentials in .env.local
 * - Test thread ID (or creates one)
 */

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_CONFIG = {
  // Number of concurrent audit writes to fire
  CONCURRENT_AUDIT_WRITES: 10,
  // Number of translation job updates to interleave
  CONCURRENT_JOB_UPDATES: 5,
  // Delay between operations (ms)
  OPERATION_DELAY: 50,
  // Thread ID to use (set to existing thread or leave null to create)
  THREAD_ID: process.env.TEST_THREAD_ID || null,
};

// ============================================================================
// Types
// ============================================================================

interface TestResult {
  passed: boolean;
  initialLinesCount: number;
  finalLinesCount: number;
  auditWriteCount: number;
  jobUpdateCount: number;
  regressionDetected: boolean;
  details: string[];
}

// ============================================================================
// Test Implementation
// ============================================================================

async function runConcurrentAuditTest(): Promise<TestResult> {
  const details: string[] = [];
  const log = (msg: string) => {
    console.log(`[TEST] ${msg}`);
    details.push(msg);
  };

  // Dynamic imports to avoid compilation issues in non-test environments
  const { supabaseServer } = await import("@/lib/supabaseServer");
  const { pushAuditToThreadState } = await import("@/lib/ai/audit");
  const { updateTranslationJob, createTranslationJob, getTranslationJob } =
    await import("@/lib/workshop/jobState");

  const supabase = await supabaseServer();

  // Get or create test thread
  let threadId: string | null = TEST_CONFIG.THREAD_ID;

  if (!threadId) {
    log("Creating test thread...");
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("Not authenticated. Set valid auth in .env.local");
    }

    const { data: thread, error } = await supabase
      .from("chat_threads")
      .insert({
        title: `[TEST] Concurrent Audit Test ${new Date().toISOString()}`,
        created_by: user.user.id,
        state: {},
      })
      .select("id")
      .single();

    if (error || !thread) {
      throw new Error(`Failed to create test thread: ${error?.message}`);
    }

    threadId = thread.id;
    log(`Created test thread: ${threadId}`);
  } else {
    log(`Using existing thread: ${threadId}`);
  }

  // Initialize a translation job with 2 chunks
  const testChunks = [
    {
      number: 1,
      text: "Line 1\nLine 2\nLine 3\nLine 4",
      lines: ["Line 1", "Line 2", "Line 3", "Line 4"],
      lineCount: 4,
      startLineIndex: 0,
    },
    {
      number: 2,
      text: "Line 5\nLine 6\nLine 7\nLine 8",
      lines: ["Line 5", "Line 6", "Line 7", "Line 8"],
      lineCount: 4,
      startLineIndex: 4,
    },
  ];

  log("Creating translation job with 2 chunks...");
  await createTranslationJob(
    {
      threadId: threadId!,
      chunks: testChunks,
      stanzas: testChunks,
      poem: testChunks.map((c) => c.lines.join("\n")).join("\n\n"),
    },
    { maxConcurrent: 2 }
  );

  // Verify initial state
  let job = await getTranslationJob(threadId!);
  if (!job) {
    throw new Error("Failed to get initial job state");
  }

  const initialChunk0Lines = job.chunks?.[0]?.lines?.length ?? 0;
  log(`Initial chunk[0].lines.length: ${initialChunk0Lines}`);

  // Track max lines seen (for regression detection)
  let maxLinesSeenChunk0 = initialChunk0Lines;
  let regressionDetected = false;

  // Simulate concurrent operations
  log(
    `Starting ${TEST_CONFIG.CONCURRENT_AUDIT_WRITES} audit writes + ${TEST_CONFIG.CONCURRENT_JOB_UPDATES} job updates...`
  );

  const operations: Promise<void>[] = [];

  // Fire audit writes concurrently
  for (let i = 0; i < TEST_CONFIG.CONCURRENT_AUDIT_WRITES; i++) {
    operations.push(
      (async () => {
        await new Promise((r) =>
          setTimeout(r, Math.random() * TEST_CONFIG.OPERATION_DELAY)
        );
        try {
          await pushAuditToThreadState(threadId!, {
            ts: new Date().toISOString(),
            threadId: threadId!,
            lineIndex: i,
            mode: "balanced",
            model: "test",
            recipe: { cacheHit: "miss", schemaVersion: "test" },
            gate: { pass: true },
          });
          log(`Audit write ${i} completed`);
        } catch (e) {
          log(`Audit write ${i} failed: ${e}`);
        }
      })()
    );
  }

  // Fire job updates concurrently (simulating line completion)
  for (let i = 0; i < TEST_CONFIG.CONCURRENT_JOB_UPDATES; i++) {
    operations.push(
      (async () => {
        await new Promise((r) =>
          setTimeout(r, Math.random() * TEST_CONFIG.OPERATION_DELAY * 2)
        );
        try {
          await updateTranslationJob(threadId!, (draft) => {
            const chunk = draft.chunks?.[0];
            if (chunk) {
              // Add a line to chunk 0
              chunk.lines = chunk.lines || [];
              chunk.lines.push({
                line_number: chunk.lines.length,
                original_text: `Test line ${chunk.lines.length}`,
                translations: [],
                translationStatus: "translated",
                alignmentStatus: "pending",
                updated_at: Date.now(),
              } as any);
              chunk.linesProcessed = chunk.lines.length;
              log(`Job update ${i}: chunk[0].lines now has ${chunk.lines.length} lines`);
            }
            return draft;
          });
        } catch (e) {
          log(`Job update ${i} failed: ${e}`);
        }
      })()
    );
  }

  // Also check for regressions periodically
  operations.push(
    (async () => {
      for (let check = 0; check < 10; check++) {
        await new Promise((r) => setTimeout(r, TEST_CONFIG.OPERATION_DELAY * 3));
        const checkJob = await getTranslationJob(threadId as string);
        if (checkJob) {
          const currentLines = checkJob.chunks?.[0]?.lines?.length ?? 0;
          if (currentLines > maxLinesSeenChunk0) {
            maxLinesSeenChunk0 = currentLines;
          }
          if (currentLines < maxLinesSeenChunk0) {
            log(
              `❌ REGRESSION DETECTED: chunk[0].lines went from ${maxLinesSeenChunk0} to ${currentLines}`
            );
            regressionDetected = true;
          }
        }
      }
    })()
  );

  // Wait for all operations
  await Promise.allSettled(operations);

  // Final verification
  job = await getTranslationJob(threadId!);
  const finalChunk0Lines = job?.chunks?.[0]?.lines?.length ?? 0;

  log(`Final chunk[0].lines.length: ${finalChunk0Lines}`);
  log(`Max lines seen during test: ${maxLinesSeenChunk0}`);

  // Determine pass/fail
  const passed = !regressionDetected && finalChunk0Lines >= maxLinesSeenChunk0;

  return {
    passed,
    initialLinesCount: initialChunk0Lines,
    finalLinesCount: finalChunk0Lines,
    auditWriteCount: TEST_CONFIG.CONCURRENT_AUDIT_WRITES,
    jobUpdateCount: TEST_CONFIG.CONCURRENT_JOB_UPDATES,
    regressionDetected,
    details,
  };
}

// ============================================================================
// Test Runner
// ============================================================================

async function main() {
  console.log("=".repeat(80));
  console.log("CONCURRENT AUDIT WRITE REGRESSION TEST");
  console.log("=".repeat(80));
  console.log();

  // Set env to enable audit persistence for testing
  process.env.PERSIST_METHOD2_AUDIT = "1";

  try {
    const result = await runConcurrentAuditTest();

    console.log();
    console.log("=".repeat(80));
    console.log("TEST RESULT");
    console.log("=".repeat(80));
    console.log(`Status: ${result.passed ? "✅ PASSED" : "❌ FAILED"}`);
    console.log(`Initial lines: ${result.initialLinesCount}`);
    console.log(`Final lines: ${result.finalLinesCount}`);
    console.log(`Audit writes: ${result.auditWriteCount}`);
    console.log(`Job updates: ${result.jobUpdateCount}`);
    console.log(`Regression detected: ${result.regressionDetected ? "YES" : "NO"}`);
    console.log();

    if (!result.passed) {
      console.log("FAILURE DETAILS:");
      result.details
        .filter((d) => d.includes("REGRESSION") || d.includes("failed"))
        .forEach((d) => console.log(`  - ${d}`));
      process.exit(1);
    }

    process.exit(0);
  } catch (e) {
    console.error("Test failed with error:", e);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { runConcurrentAuditTest };
export type { TestResult };
