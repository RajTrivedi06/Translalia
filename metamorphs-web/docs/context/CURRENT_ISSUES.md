## Current Issues (as of YYYY-MM-DD)

### Issue: Dev-only debug route exposed

- Severity: Low
- Effort: <0.5 day
- Impact: `GET /api/debug/whoami` and `GET /api/dev/thread-state` exist; `whoami` has a TEMP DEBUG comment
- Workaround: Ensure production checks guard access (`dev/thread-state` already blocks in prod)
- Root Cause: Temporary diagnostics left in repo
- LLM Note: Do not rely on debug endpoints in production code

### Issue: In-memory cache and rate limit not distributed

- Severity: Medium
- Effort: 1–2 days
- Impact: Cache and token buckets reset on deploy and do not share across instances
- Workaround: None; acceptable for single-instance dev/staging
- Root Cause: MVP implementation in `lib/ai/cache.ts` and `lib/ai/ratelimit.ts`
- LLM Note: Avoid assuming global cache; idempotent design required

### Issue: Soft budget and per-user per-minute are placeholders

- Severity: Medium
- Effort: 1–2 days
- Impact: Policy constants in `lib/policy.ts` marked "wire later" are not enforced globally
- Workaround: Preview endpoint has its own limiter; others rely on UX
- Root Cause: Budget controls not implemented yet
- LLM Note: Do not add costly loops; reuse caches and keep payloads minimal

### Issue: Missing formal migrations directory

- Severity: Medium
- Effort: 1 day
- Impact: Schema drift risk; `chat_threads.state` column required by code
- Workaround: Manual SQL provided in docs (`flags-and-models.md`)
- Root Cause: Supabase CLI migrations not yet adopted
- LLM Note: When introducing new tables/columns, include SQL/migration notes

### Issue: RLS policies assumed but not present in repo

- Severity: High
- Effort: 2–3 days
- Impact: Security relies on DB-side RLS; policies must be provisioned in environments
- Workaround: None in code; must configure in Supabase
- Root Cause: Policies are environment config, not versioned here
- LLM Note: Never bypass `requireUser`; scope queries by `project_id`/`thread_id`

### Issue: Nodes polling frequency vs. DB load

- Severity: Low
- Effort: 0.5–1 day
- Impact: `useNodes` polls every 1.5s; may be chatty for many users
- Workaround: Keep polling for MVP; consider Realtime or backoff
- Root Cause: Simplicity-first polling
- LLM Note: Keep poll intervals configurable and avoid tight loops

### Issue: Enhancer/Translator model output drift

- Severity: Medium
- Effort: 1–2 days
- Impact: Non-conforming outputs cause 502; recoverability via retries
- Workaround: Structured prompts + Zod; return `raw` for diagnostics
- Root Cause: Model variance
- LLM Note: Always validate; handle 502 with user-facing guidance

---

## Known Limitations

- No distributed cache/ratelimit; multi-instance requires Redis or equivalent
- No DB realtime; nodes/journey rely on polling/refetch
- Budget enforcement is not global; soft policy only
- RBAC/RLS defined externally; missing from repo
- Schema migrations not tracked in-repo; manual steps required

Performance/scalability:

- Nodes polling at 1.5s; consider exponential backoff or user-driven refresh
- Translator preview cost depends on poem length; cache hit rate is critical

Browser/platform:

- Requires localStorage/cookies for Supabase auth; standard modern browsers supported

---

## Planned Improvements

- Adopt Supabase CLI migrations and version RLS policies
- Introduce Redis-backed cache and rate limiting
- Add per-project daily spend enforcement with alerting
- Optional DB realtime for nodes/journey updates
- Admin tools for moderation review and system health

Roadmap (tentative):

- Q1: Migrations + RLS policy scripts; cache/ratelimit via Redis
- Q2: Spend enforcement + alerts; realtime updates

Breaking changes ahead:

- Nodes API response shape may expand with additional metadata
- Flow phases may add `editing` between `translating` and `review`

Migration strategies:

- Keep backward-compatible fields; feature-flag new behaviors; offer dual-read paths

---

## Issue Context for Code Generation

- Use `requireUser` on write routes; return 401/403 properly
- Cache and rate limit LLM endpoints; use stable hash keys
- Validate all LLM outputs with Zod and fail fast with 502
- Avoid tight polling; prefer refetch on important actions

### Temporary Workarounds

- Use manual SQL for `chat_threads.state` when setting up environments
- Keep preview limiter at 30/min/thread; avoid adding more hot paths

### Testing Requirements

- Verify 4xx/5xx handling for all LLM routes (400/401/403/409/429/502)
- Ensure nodes list updates after preview/instruct and accept-lines
- Confirm unauthorized access is blocked on protected routes

### Code Patterns to Avoid

- Bypassing `requireUser` and using client tokens directly server-side
- Persisting unvalidated LLM outputs
- Creating new long-pollers; use existing hooks and intervals

## Current Issues

Use this list to track known issues, tech debt, and active investigations.

### Open Items

- Clarify DB schema source of truth and add migrations if missing
- Normalize API error shapes across `app/api/*`
- Document environment variable requirements for local development

### Recently Fixed

- Placeholder for recent fixes with links to PRs/commits

### Monitoring & Alerts

- Define minimal logging and error tracking policy for API routes

---

## CURRENT_ISSUES

- Validate inferred DB schema vs Supabase project; add migrations if not tracked
- Consider adding DB realtime or server-sent events for live updates
- Standardize API error shapes across all routes
- Centralize env var validation on startup
- Add logging/observability for API route errors
