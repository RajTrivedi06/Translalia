# Post-Review Fixes — Scalability Implementation

These are fixes identified during code review. Apply them in order.
Run `npm run typecheck` after all fixes to confirm clean compilation.

---

## Fix 1: Remove unenforced `MAX_ACTIVE_PER_USER` (must fix)

**Problem:** `MAX_ACTIVE_PER_USER` is declared at `translalia-web/src/lib/workshop/translationQueue.ts` lines 20-23 and the docstring on `enqueueTranslationJob` (line 72) claims it enforces a per-user cap, but no code actually checks it. This is dead code that misleads readers.

**File:** `translalia-web/src/lib/workshop/translationQueue.ts`

**Changes:**
1. Delete lines 20-23 (the `MAX_ACTIVE_PER_USER` constant).
2. Update the docstring on `enqueueTranslationJob` (lines 67-74) — remove the line that says `* - Rejects if user has MAX_ACTIVE_PER_USER active jobs.`

**Also update docs:**
- `docs/02-reference/config-and-env.md`: Remove the `TRANSLATION_MAX_ACTIVE_PER_USER` entry. Add a comment or note that per-user admission control is not currently implemented and can be added later if needed.

---

## Fix 2: Add `edgeState` to client-side `TranslationStatusResponse` type (must fix)

**Problem:** The server now returns an `edgeState` field in `translation-status` responses, but the client-side `TranslationStatusResponse` interface in `useTranslationJob.ts` doesn't include it. Components cannot type-safely consume `edgeState`.

**File:** `translalia-web/src/lib/hooks/useTranslationJob.ts`

**Changes:**
1. Add `edgeState` and `readyLines` to the `TranslationStatusResponse` interface (lines 22-27). The updated interface should be:

```typescript
interface TranslationStatusResponse {
  ok: boolean;
  job: TranslationJobState | null;
  tick: TranslationTickResult | null;
  progress: TranslationJobProgressSummary | null;
  readyLines?: unknown[];
  edgeState?: "no-job" | "in-progress" | "completed" | "failed";
}
```

No other changes needed — existing code that checks `job.status` still works, and components can now optionally use `edgeState`.

---

## Fix 3: Add comment to startup self-heal explaining single-instance assumption (should fix)

**Problem:** `startupActiveSetCleanup()` in the worker wipes ALL active-set entries on boot, not just stale ones. This is correct for a single-instance worker, but would break multi-worker deployments. The assumption should be documented.

**File:** `translalia-web/scripts/translation-worker.ts`

**Changes:**
1. Update the docstring on `startupActiveSetCleanup` (lines 197-202) to:

```typescript
/**
 * Startup self-heal: clear ALL entries from active sets.
 *
 * ASSUMPTION: This worker is the sole consumer. On restart, nothing from
 * a previous run is genuinely in-progress. Items still in the queue list
 * will be re-processed naturally.
 *
 * WARNING: If you ever run multiple worker instances, this function must
 * be changed to use age-based filtering (like periodicActiveSetGC does)
 * instead of blanket removal. Otherwise it will evict entries that another
 * instance is actively processing.
 */
```

---

## Fix 4: Run periodic GC regardless of queue emptiness (should fix)

**Problem:** Periodic GC at line ~370 only triggers when `tickCount % GC_INTERVAL_TICKS === 0` AND the queue was empty that iteration. Under sustained load, GC never runs, so stale active-set entries accumulate.

**File:** `translalia-web/scripts/translation-worker.ts`

**Changes:**
1. Find the section in the `main()` loop where GC is triggered (around line 370). It currently looks something like:

```typescript
if (tickCount % GC_INTERVAL_TICKS === 0 && /* some idle condition */) {
  await periodicActiveSetGC();
}
```

Change it to run GC purely on the tick interval, regardless of queue state:

```typescript
if (tickCount % GC_INTERVAL_TICKS === 0) {
  await periodicActiveSetGC();
}
```

The GC function itself is already safe (only removes entries older than the stale threshold), so running it during active processing won't cause issues.

---

## Fix 5: Clean up `inFlightAlignment` on job completion (should fix)

**Problem:** `inFlightAlignment` map entries are set when alignment jobs are dequeued but never deleted on successful completion. They pile up and are only reaped by periodic GC. This is a minor memory leak in long-running workers.

**File:** `translalia-web/scripts/translation-worker.ts`

**Changes:**
1. Find where alignment jobs complete successfully (likely near where `deactivateAlignmentJob` is called after successful processing).
2. Add `inFlightAlignment.delete(threadId)` immediately after `deactivateAlignmentJob(threadId)` in the success path, matching how `inFlightTranslation.delete(threadId)` is handled for translation jobs.

---

## Fix 6: Add try-catch around `getTranslationJob` in initialize-translations (should fix)

**Problem:** `translalia-web/src/app/api/workshop/initialize-translations/route.ts` line 123 calls `getTranslationJob(threadId)` without a try-catch, unlike `translation-status/route.ts` which wraps the same call defensively. If `getTranslationJob` throws, the route returns 500.

**File:** `translalia-web/src/app/api/workshop/initialize-translations/route.ts`

**Changes:**
1. Wrap the `getTranslationJob` call at line 123 in a try-catch:

```typescript
let latestJob: Awaited<ReturnType<typeof getTranslationJob>> = null;
try {
  latestJob = await getTranslationJob(threadId);
} catch (err) {
  console.error("[initialize-translations] Failed to fetch job after creation:", err);
  // Job was created successfully, just can't fetch it back — return what we have
}
const progress = latestJob ? summarizeTranslationJob(latestJob) : null;
```

---

## Verification

After all fixes, run:

```bash
cd translalia-web
npm run typecheck
```

Expected: clean compilation, no errors.
