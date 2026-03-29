# ADR 0004: Decouple Status Polling from Work Advancement and Add Queue Controls

## Status
Accepted

## Context
`translation-status` was coupling two concerns: returning current job state (read) and advancing translation work (write). This meant:
- UI polling frequency directly influenced work throughput.
- Reasoning about worker capacity required understanding client polling patterns.
- Multiple concurrent pollers could trigger redundant tick executions (mitigated by locking, but creating unnecessary lock contention).

The translation queue also lacked backpressure:
- No queue depth limit — unbounded enqueue was possible.
- No retry budget — jobs could re-enqueue indefinitely without progress.
- No DLQ — stuck jobs had no terminal state and blocked the active set permanently.
- Queue messages were raw threadId strings with no metadata for debugging.

## Decision

### Read/Advance Split
- Add `ENABLE_STATUS_READ_ADVANCE_SPLIT` flag.
- When enabled, `translation-status` ignores the `advance` query parameter and always returns a read-only response.
- The worker (`scripts/translation-worker.ts`) is the sole owner of work advancement.

### Adaptive Client Polling
- Change default poll interval from fixed 1.5s to adaptive: 1.5s for first 5 polls, then 4s.
- Default `advanceOnPoll` changed from `true` to `false` in `useTranslationJob`.
- Expected 50-70% reduction in polling request volume.

### Queue Admission Control
- Queue depth limit (`TRANSLATION_MAX_QUEUE_DEPTH`, default 100).
- Poem size limit (`MAX_POEM_LINES_FOR_TRANSLATION`, default 200).
- `enqueueTranslationJob` returns `{ enqueued, reason }` instead of void.

### Structured Queue Messages
- Queue payloads upgraded from raw threadId to JSON with `threadId`, `attempt`, `enqueuedAt`, `failureClass`, `traceId`, `userId`.
- Worker `parseQueueMessage` handles both legacy (raw string) and structured (JSON) formats for safe deploy-order rollout.

### Retry/DLQ
- Max 5 re-enqueue attempts without progress before DLQ capture.
- Jobs that make progress have their attempt counter reset.
- DLQ entries include full structured metadata for investigation.

## Consequences

### Positive
- Polling load reduced without backend changes.
- Worker throughput is independent of client polling frequency.
- Stuck jobs have a terminal state (DLQ) instead of infinite re-enqueue.
- Queue metadata enables root-cause analysis of failures.

### Negative
- With `advance=false`, translations only progress via worker. If the worker is down, no progress happens (previously, polling could advance work as fallback).
- Requires worker to be running for any translation progress.

### Neutral
- The read/advance split is feature-flagged — can be disabled if the worker-only model proves insufficient.

## Links
- Status route: `translalia-web/src/app/api/workshop/translation-status/route.ts`
- Polling hook: `translalia-web/src/lib/hooks/useTranslationJob.ts`
- Queue module: `translalia-web/src/lib/workshop/translationQueue.ts`
- Worker: `translalia-web/scripts/translation-worker.ts`
