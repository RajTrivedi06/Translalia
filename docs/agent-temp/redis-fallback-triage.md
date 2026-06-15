# Redis Failure Mode Triage

## Current Redis-dependent subsystems

This triage documents what happens when Upstash Redis is unavailable, and classifies each subsystem's fallback as acceptable or needs-fix at the current user scale (5-20 concurrent users).

---

## 1. Rate Limiting (`src/lib/ratelimit/redis.ts`)

**Current fallback**: In-memory Map.

**Problem**: On Vercel, each serverless function instance has its own memory. Rate limits tracked in-memory are not shared across instances. A user hitting different instances can bypass rate limits entirely.

**Severity at current scale**: Low-Medium. With 5-20 users, the blast radius of a bypass is small. But a single user could exhaust LLM budget if they hit many instances in parallel.

**Classification**: Acceptable risk with monitoring. Not a blocking issue at current scale.

**Mitigation if needed**: Add a circuit breaker that rejects all rate-limited requests when Redis is unavailable (fail-closed instead of fail-open). This is a one-line change in `checkRateLimit` / `checkDailyLimit`.

---

## 2. Recipe Locks (`src/lib/ai/cache.ts` via `lockHelper`)

**Current fallback**: In production with `USE_REDIS_LOCK=true`, `getUpstashRedis()` throws if Redis is not configured. If Redis is configured but transiently unavailable, `lockHelper.acquire` will throw, and callers retry until their retry budget is exhausted.

**Problem**: Transient Redis outage causes lock acquisition failures. Callers (e.g., recipe generation in `variantRecipes.ts`) will retry with backoff, but if Redis stays down, the operation fails entirely. No fallback to in-memory locking in production.

**Severity at current scale**: Medium. Recipe generation for a thread would fail until Redis recovers. Other threads and non-lock-dependent operations continue.

**Classification**: Acceptable risk — Redis transient outages are rare with Upstash. The retry-with-backoff behavior is reasonable. Full Redis loss would need manual intervention regardless.

**Mitigation if needed**: Add a configurable lock bypass mode (skip locking if Redis is down for > N seconds). This risks duplicate recipe generation but not data corruption, since recipe results are idempotent.

---

## 3. LLM Response Cache (`src/lib/ai/cache.ts` via `cacheGet`/`cacheSet`)

**Current fallback**: In-memory Map.

**Problem**: Same as rate limiting — in-memory Map is per-instance on Vercel. Cache misses spike, causing duplicate LLM calls. This increases latency and cost.

**Severity at current scale**: Medium. With 5-20 users, the cost spike from cache misses is bounded but real. If a user triggers the same translation/suggestion multiple times, each instance would re-call the LLM.

**Classification**: Acceptable risk with cost monitoring. The existing content-hash-addressed keys mean duplicate calls produce identical results — no data corruption, just cost.

**Mitigation if needed**: Add a cost alert that fires when LLM call rate exceeds baseline by > 2x. This surfaces Redis cache failures through cost metrics rather than requiring Redis health checks in application code.

---

## 4. Translation Queue (`src/lib/workshop/translationQueue.ts`)

**Current fallback**: In dev, logs a warning. In production, throws.

**Problem**: If Redis is down in production, translation job enqueue fails. The user sees an error.

**Severity at current scale**: High for the affected operation. User cannot start new translations until Redis recovers.

**Classification**: Acceptable — Redis is a hard dependency for the queue. No reasonable fallback exists at current scale. Upstash SLA makes this rare.

---

## 5. Alignment Queue (`src/lib/workshop/alignmentQueue.ts`)

**Current fallback**: Same as translation queue — throws in production.

**Classification**: Acceptable — alignment is currently disabled anyway.

---

## Summary

| Subsystem | Fallback | Acceptable? | Action |
|-----------|----------|-------------|--------|
| Rate limiting | In-memory Map (bypassed across instances) | Yes at current scale | Monitor; consider fail-closed if abuse detected |
| Recipe locks | Throw + retry exhaustion | Yes | Monitor recovery time |
| LLM cache | In-memory Map (cost spike on miss) | Yes at current scale | Add cost baseline alert in Phase 4 if cost governance is gated in |
| Translation queue | Throw (hard dependency) | Yes | Upstash SLA covers this; no app-level fallback feasible |
| Alignment queue | Throw (currently disabled) | Yes | No action needed |

## Decision

All Redis fallback behaviors are acceptable at the current user scale (5-20 concurrent users). No immediate fixes are required.

**Accepted risks to revisit if scale increases:**
- Rate limiting bypass across Vercel instances (switch to fail-closed if abuse patterns appear).
- LLM cache miss cost spike (add cost alerting as part of Phase 4 if cost governance proceeds).
