# Scalability and Safety Validation Runbook

## Purpose
This runbook provides a safe, repeatable way to validate scalability-related behavior after recent API hardening changes:

- debug endpoint protection
- per-user rate-limiting behavior
- queue and worker health
- polling and translation job stability

It is written for local or staging verification with controlled load.

## Scope
This runbook verifies behavior for:

- `translalia-web/src/app/api/debug/*`
- `translalia-web/src/app/api/auth/debug-cookies/route.ts`
- workshop/notebook/journey/reflection/verification rate-limited routes
- translation queue and status polling paths

## Safety Guardrails (Read First)

- Use a test account and test project/thread only.
- Prefer staging over production.
- Do not run high-concurrency loops against production.
- Do not run any destructive project/thread delete calls in this runbook.
- Stop immediately if you see elevated error rates or queue growth that does not recover.

## Pre-Checks

### 0. Stale active-set cleanup

The worker now clears stale active-set entries on startup (self-heal). To verify this works, or to run a manual one-time flush before baseline measurement:

```bash
cd "/Users/raaj/Documents/CS/AIDCPT/translalia-web"

# Check current active-set sizes before starting the worker
node -e '
const { Redis } = require("@upstash/redis");
const r = new Redis({url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN});
(async () => {
  const ta = await r.scard("translation:queue:active");
  const aa = await r.scard("alignment:queue:active");
  console.log("BEFORE cleanup:", {translationActive: ta, alignmentActive: aa});
})();
'

# Start the worker — it will clear active sets on boot
npm run worker:translations
# Look for "[translation-worker] Startup cleanup complete" in output

# Verify active sets are clean (in another terminal)
node -e '
const { Redis } = require("@upstash/redis");
const r = new Redis({url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN});
(async () => {
  const ta = await r.scard("translation:queue:active");
  const aa = await r.scard("alignment:queue:active");
  console.log("AFTER cleanup:", {translationActive: ta, alignmentActive: aa});
})();
'
```

Expected: active sets go to 0 on worker boot. Worker logs show count of cleared entries.

To disable GC if false positives occur: set `ENABLE_WORKER_ACTIVE_SET_GC=0`.
To tune stale threshold: set `WORKER_STALE_THRESHOLD_MS` (default: 1800000 = 30 min).

1. Start web app:

```bash
cd "/Users/raaj/Documents/CS/AIDCPT/translalia-web"
npm run dev
```

2. Start worker in a separate terminal:

```bash
cd "/Users/raaj/Documents/CS/AIDCPT/translalia-web"
npm run worker:translations
```

3. Export common variables:

```bash
export BASE_URL="http://localhost:3000"
export TOKEN="<bearer_token>"
export THREAD_ID="<test_thread_uuid>"
```

4. Confirm type safety before runtime checks:

```bash
cd "/Users/raaj/Documents/CS/AIDCPT/translalia-web"
npm run typecheck
```

Expected: command exits successfully.

---

## Frozen Workload Profiles (Phase 0 Baseline)

These are the fixed workload definitions used for all baseline and regression runs.
Do not modify these during the scalability program — comparisons depend on consistency.

| Workload | Poem size | Concurrent pollers | Concurrent jobs | Duration | Recovery window |
|----------|-----------|-------------------|-----------------|----------|-----------------|
| W1-small | ~12 lines | 3 | 1 | 10 min | 5 min |
| W2-medium | ~40 lines | 10 | 3 | 10 min | 5 min |
| W3-large | ~120 lines | 20 | 5 | 10 min | 5 min |

Environment:
- **Local**: sanity check only (confirms no crashes, rough behavior).
- **Staging**: source of truth for decision gates.

For each baseline run, fill in the artifact template at `docs/agent-temp/baseline-artifact-template.md`.
Run 3 passes minimum per workload before drawing conclusions.

---

## Test A: Debug Endpoint Protection

### A1. Verify debug routes require auth

```bash
curl -i "$BASE_URL/api/debug/env-check"
curl -i "$BASE_URL/api/debug/test-rpc"
curl -i "$BASE_URL/api/debug/whoami"
curl -i "$BASE_URL/api/auth/debug-cookies"
```

Expected: `401` or auth error response without token.

### A2. Verify debug routes work with auth in local/non-production

```bash
curl -i -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/debug/env-check"
curl -i -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/debug/test-rpc"
```

Expected: `200` in local/non-production.  
Also verify responses do not expose raw secrets.

### A3. Production-like gating check

In production-like env where `DEBUG_API_ENABLED` is unset:
- expected response: `404` for debug endpoints.

Pass criteria:
- unauthenticated access denied
- production-like access blocked unless explicitly enabled
- no sensitive secret leakage

---

## Test B: Rate-Limit Enforcement

This test validates that high-cost routes throttle correctly.

### B1. Confirm `429` behavior on burst

Use one endpoint at a time, with bounded loops:

```bash
for i in {1..120}; do
  curl -s -X POST "$BASE_URL/api/notebook/poem-suggestions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"threadId":"'"$THREAD_ID"'","sourcePoem":"one two three four five six seven eight nine ten","translationPoem":"uno dos tres cuatro cinco seis siete ocho nueve diez"}' \
    | jq -r '.error.code // "OK"'
done | sort | uniq -c
```

Repeat for:

- `/api/notebook/prismatic`
- `/api/workshop/retry-line`
- `/api/workshop/additional-suggestions`
- `/api/journey/generate-reflection`
- `/api/journey/generate-brief-feedback`

Pass criteria:
- requests eventually return `429`
- response includes limit/remaining/reset style metadata where applicable
- no `500` surge during normal throttling

---

## Test C: Translation Status Polling Stability

### C1. Moderate parallel status polling

```bash
for i in {1..30}; do
  curl -s -o /dev/null -w "%{http_code} %{time_total}\n" \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/api/workshop/translation-status?threadId=$THREAD_ID&advance=true" &
done
wait
```

Pass criteria:
- mostly `200` responses
- no sustained `5xx`
- app remains responsive
- worker continues processing

### C2. Check lock/skip behavior in logs

Expected patterns:
- lock skip when tick already in progress
- no uncontrolled overlapping tick execution

---

## Test D: Queue and Worker Health

### D1. Observe worker progression

During active jobs, confirm:

- queue size grows briefly then drains
- active set does not remain stuck for completed jobs
- worker re-enqueue behavior does not create runaway loops

### D2. Basic Redis queue snapshot (optional)

```bash
node -e '
const { Redis } = require("@upstash/redis");
const r = new Redis({url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN});
(async () => {
  const q = await r.llen("translation:queue");
  const a = await r.scard("translation:queue:active");
  const dlq = await r.llen("translation:dlq");
  const aq = await r.llen("alignment:queue");
  const aa = await r.scard("alignment:queue:active");
  console.log({translationQueue:q,translationActive:a,translationDLQ:dlq,alignmentQueue:aq,alignmentActive:aa});
})();
'
```

Pass criteria:
- queue depth returns toward zero after workload
- active sets do not remain permanently elevated
- DLQ contains only genuinely stuck jobs (not growing rapidly)

---

## Test E: Edge State Correctness

### E1. Translation status with no job

```bash
# Use a thread that has NOT had translations initialized
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/workshop/translation-status?threadId=$THREAD_ID&advance=false" | jq .
```

Expected response:
```json
{ "ok": true, "job": null, "tick": null, "progress": null, "readyLines": [], "edgeState": "no-job" }
```

Pass criteria:
- `200` (not `500`)
- `edgeState` is `"no-job"`
- response body is well-formed JSON

### E2. Translation status with advance=false (read-only)

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/workshop/translation-status?threadId=$THREAD_ID&advance=false" | jq .edgeState
```

Pass criteria: returns current state without triggering a tick.

---

## Test F: Queue Controls

### F1. Dead-letter queue check

After running workloads, verify DLQ:

```bash
node -e '
const { Redis } = require("@upstash/redis");
const r = new Redis({url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN});
(async () => {
  const dlqLen = await r.llen("translation:dlq");
  console.log("DLQ length:", dlqLen);
  if (dlqLen > 0) {
    const items = await r.lrange("translation:dlq", 0, 4);
    console.log("DLQ samples:", items);
  }
})();
'
```

Pass criteria:
- DLQ captures jobs that exceeded 5 re-enqueue attempts
- No jobs re-enqueued indefinitely

### F2. Poem size limit

```bash
# Attempt to initialize translation for a poem that would exceed MAX_POEM_LINES_FOR_TRANSLATION
# (requires a test thread with a very large poem)
```

Pass criteria: returns `400` with descriptive error message.

---

## Test G: Regression Checklist (Quick)

- [ ] Debug endpoints blocked in production-like env
- [ ] Debug endpoints require auth in non-production
- [ ] Newly protected routes enforce rate limits
- [ ] Per-user keying prevents cross-thread bypass behavior
- [ ] No sustained `5xx` under moderate polling pressure
- [ ] Worker drains queue without persistent backlog
- [ ] Worker startup clears stale active-set entries
- [ ] translation-status returns `200` with `edgeState: "no-job"` when no job exists
- [ ] Adaptive polling reduces request volume compared to fixed 1.5s
- [ ] No jobs re-enqueued more than 5 times without DLQ capture
- [ ] Poem size limit rejects oversized poems

---

## Incident Triggers (Stop and Investigate)

Stop testing and investigate if any of the following occur:

- sustained `5xx` on core API routes
- queue depth increasing continuously for 10+ minutes
- lock contention logs with no throughput progress
- repeated state inconsistency warnings without recovery
- DLQ growing rapidly (indicates systemic failure, not isolated bad jobs)
- active-set size does not decrease after worker GC cycle

## Notes for Maintainers

- Keep this runbook temporary in `docs/agent-temp/`.
- If this process becomes standard release practice, migrate a stable version into `docs/guides/` and link from `docs/INDEX.md`.
