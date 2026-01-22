# Last Line Stuck in Processing - Issue Report

## Problem Statement
Translation jobs get stuck with the last line (or last few lines) of a stanza perpetually in "processing" state. The UI shows continuous polling but the job never completes.

## Current State After Investigation

Multiple fixes were attempted but the issue persists. This report documents the current code state and remaining hypotheses.

---

## Code Changes Made (That May Have Introduced Issues)

### 1. processStanza.ts - Lines 457-501
Added interrupt flag re-check logic that loads from DB to verify if all lines are actually completed:
```typescript
if (interrupted) {
  const jobCheckInterrupt = await getTranslationJob(threadId);
  // ... checks if all lines are done in DB
  if (actualAllTranslated && actualAllPresent) {
    interrupted = false;  // Clear flag
  }
}
```

**Potential Issue:** This adds an extra DB read on every interrupted stanza, which could cause timing issues or race conditions.

### 2. processStanza.ts - Lines 572-612
Added "safety completion" check that tries to mark chunk as completed:
```typescript
if (permanentFailures.length === 0 && !interrupted) {
  const jobAfterUpdate = await getTranslationJob(threadId);
  // ... checks and marks completed
}
```

**Potential Issue:** This reads from DB right after writing, which may not reflect the latest state due to eventual consistency or caching.

### 3. runTranslationTick.ts - Lines 940-990
Modified interrupted handler to check if chunks are actually completed:
```typescript
interrupted.forEach((index) => {
  // ... checks if all lines done
  if (allLinesTranslated && allLinesPresent) {
    stanzaState.status = "completed";
  }
});
```

**Potential Issue:** This logic may conflict with the existing completion logic at lines 791-849.

### 4. runTranslationTick.ts - Lines 265-308
Added `fixStuckChunks` watchdog function.

### 5. runTranslationTick.ts & jobState.ts
Modified `isIncomplete` and `hasActiveWorkFromChunks` to check for terminal status instead of `linesProcessed`.

---

## Remaining Hypotheses for Root Cause

### Hypothesis A: Race Condition in Line Persistence
`updateSingleLine` is called for each line as it completes. If multiple lines complete near-simultaneously, there could be concurrent modification conflicts that cause some line updates to fail silently or be overwritten.

**Evidence needed:** Check if `lines.length < totalLines` even after all translations complete.

### Hypothesis B: completedLines Array vs DB State Mismatch
The `completedLines` array is built from successful Promise results, but `updateSingleLine` persists to DB separately. If a line translation succeeds but `updateSingleLine` fails, the line is in `completedLines` but not in the DB.

**Evidence needed:** Compare `completedLines.length` vs `chunkAfterUpdate.lines.length` in safety completion check.

### Hypothesis C: Budget Check Timing
The budget check happens at two points:
1. Before starting a line (line 236)
2. After acquiring permit (line 282)

If the last line passes both checks, starts translating, but takes longer than expected, it still completes. But if `interrupted` was set by a DIFFERENT line that saw budget exceeded, the completion logic is skipped.

**Evidence needed:** Check logs for "Stanza X had interrupt flag but ALL lines completed".

### Hypothesis D: Validation Throws Exception
At lines 658-664 and 673-684, validation checks throw errors if lines are missing or incomplete. If these throw, the chunk stays in "processing" and the error may not be properly surfaced.

**Evidence needed:** Check for "CRITICAL: Stanza X missing lines" or "has incomplete lines" in logs.

### Hypothesis E: Multiple DB Reads Return Stale Data
The safety completion check reads from DB immediately after `updateStanzaStatus`. If the DB has caching or eventual consistency, the read may return stale data where `lines.length < totalLines`.

**Evidence needed:** Add logging to compare expected vs actual line counts.

---

## Logs to Look For

When the issue occurs, these logs should help diagnose:

1. **If interrupt logic is firing:**
   - `[processStanza] ⚠️ Stanza X had interrupt flag but ALL lines completed`
   - `[processStanza] ⏱️ Stanza X INTERRUPTED: ... actual DB state: Y/Z lines`

2. **If safety completion is running:**
   - `[processStanza] Safety completion check for chunk X: lines=Y/Z, allTranslated=..., allPresent=...`
   - `[processStanza] Safety completion SKIPPED for chunk X: permanentFailures=..., interrupted=...`

3. **If watchdog is detecting stuck chunks:**
   - `[fixStuckChunks] 🔧 FIXING stuck chunk X`
   - `[runTranslationTick] ⚠️ STUCK DETECTED: Chunk X has all Y lines translated but status="processing"`

4. **If validation fails:**
   - `[processStanza] CRITICAL: Stanza X missing lines!`
   - `[processStanza] CRITICAL: Stanza X has Y incomplete lines`

5. **Tick summary (always logged):**
   - `[runTranslationTick] 📊 TICK SUMMARY: ... active=[...] queue=[...]`
   - `[runTranslationTick] 📊 CHUNK DETAILS: chunk[X]: status=... linesProcessed=Y/Z lines.length=...`

---

## Questions to Answer

1. **What does the DB state look like when stuck?**
   - Query `chat_threads.state.translation_job` for the stuck thread
   - Check each chunk's `status`, `linesProcessed`, `totalLines`, and `lines.length`
   - Check each line's `translationStatus`

2. **What are the last few log lines before it gets stuck?**
   - Is "Safety completion check" being logged?
   - Is "CHUNK DETAILS" showing correct line counts?
   - Are there any CRITICAL errors?

3. **Is the job being polled continuously?**
   - Check if `[translation-status]` logs are appearing every 4 seconds
   - Check if `[runTranslationTick]` is being called on each poll

4. **Is the lock being acquired?**
   - Check for `🔓 LOCK RELEASED` logs
   - If lock is held by another process, tick returns null immediately

---

## Recommended Next Steps (Without Code Changes)

1. **Capture full logs** from a stuck job - from initialization through several poll cycles after it stalls

2. **Query the DB directly** to see the exact state of `translation_job`:
   ```sql
   SELECT
     state->'translation_job'->'status' as job_status,
     state->'translation_job'->'queue' as queue,
     state->'translation_job'->'active' as active,
     state->'translation_job'->'chunks' as chunks
   FROM chat_threads
   WHERE id = '<stuck-thread-id>';
   ```

3. **Identify the specific stuck chunk** and check:
   - `chunks[X].status` - should it be "completed"?
   - `chunks[X].lines` - how many lines are in the array?
   - `chunks[X].totalLines` - how many lines should there be?
   - Each line's `translationStatus` - are all "translated"?

4. **Consider reverting recent changes** if the issue is new:
   - The multiple DB reads in processStanza may be causing issues
   - The modified interrupt handler in runTranslationTick may conflict with existing logic

---

## Files Modified in This Investigation

- `src/lib/workshop/processStanza.ts` - Lines 457-501 (interrupt re-check), 572-612 (safety completion)
- `src/lib/workshop/runTranslationTick.ts` - Lines 201-206 (isIncomplete), 258-308 (fixStuckChunks), 495-501 (watchdog call), 940-990 (interrupt handler)
- `src/lib/workshop/jobState.ts` - Lines 748-752 (hasActiveWorkFromChunks)
- `docs/bugs/TRANSLATION_PIPELINE_STUCK_BUG.md` - Analysis document
