# Observability

## What this file is for
Reference for the repo’s current health checks, debug endpoints, audit stores, and diagnostic flags.

## Health Endpoints

| Route | Purpose | Notes |
| --- | --- | --- |
| `/api/health` | Minimal process health | Returns `{ ok: true, ts }`. |
| `/api/verification/health` | Verification subsystem health | Reports recent in-memory metrics plus Track A/Track B feature-state flags. |

## Debug Endpoints

| Route | Purpose | Guard |
| --- | --- | --- |
| `/api/debug/env-check` | Sanitized env/config inspection | Returns `404` in production-like environments (`NODE_ENV=production` or `VERCEL_ENV=production`) unless `DEBUG_API_ENABLED=1`. |
| `/api/debug/test-rpc` | Checks `exec_sql` and related RPC availability | Diagnostic only. |
| `/api/debug/whoami` | Minimal auth check | Debug only. |
| `/api/auth/debug-cookies` | Cookie inspection for auth/session debugging | Debug only. |

## Audit and Event Storage
- `prompt_audits`: verification analytics and feedback storage.
- `translation_audits`: translation audit writes from `src/lib/ai/audit.ts`.
- `state.method2_audit`: atomic JSONB audit append path via `append_method2_audit`.

## Metrics and Timing
- Verification metrics are collected in-memory in `src/lib/verification/monitoring.ts`.
- Verification health marks the subsystem as degraded if:
  - last-hour success rate drops below 90%
  - last-hour p95 duration exceeds 10 seconds
- There is no repo-local durable metrics backend configuration beyond optional Sentry hooks in verification error handling.

## Debug Flags Most Often Used
- `ENABLE_DIAGNOSTICS`
- `DEBUG_RETRY`
- `DEBUG_GATE`
- `DEBUG_REGEN`
- `DEBUG_VARIANTS`
- `DEBUG_SUGGESTIONS`
- `DEBUG_SCHEMA`
- `DEBUG_SAMPLING`
- `DEBUG_MAIN_GEN_OUTPUT`
- `DEBUG_REGEN_OUTPUT`
- `DEBUG_OUTPUT_ON_PARSE_FAIL`

See `docs/02-reference/config-and-env.md` for the full list.

## Service Level Objectives (SLOs)

| SLO ID | Indicator | Target | Error budget | Window | Alert threshold | Owner | Rollback trigger |
|--------|-----------|--------|-------------|--------|-----------------|-------|------------------|
| SLO-1 | translation-status read p95 (advance=false) | < 300ms | 1% of requests may exceed | 1 hour rolling | > 5% of requests exceed in 15 min | backend | Revert read/advance split flag |
| SLO-2 | Duplicate tick execution per thread | 0 | 0 tolerance | Per job lifetime | Any duplicate detected | backend | Investigate lock/tick logic |
| SLO-3 | Queue oldest age recovery | Below 60s within 5 min of burst end | 2 missed recovery windows per day | Daily | 3+ missed recoveries | backend | Pause new enqueues, investigate |
| SLO-4 | Job re-enqueue without progress | Max 5 before DLQ | 0 tolerance for infinite loops | Per job | Any job exceeds 5 re-enqueues | backend | Kill switch on queue advancement |
| SLO-5 | API error rate (5xx) on core routes | < 1% | 5% of 1-hour windows may exceed | 1 hour rolling | > 3% for 10 min | backend | Review recent deploy, revert if correlated |
| SLO-6 | Worker active-set stale entries | 0 after GC | 0 tolerance | Per GC cycle | Any stale entry persists > 2 GC cycles | backend | Manual flush + investigate |

## LLM Route Coverage Audit

All 16 LLM-calling API routes have rate limiting. Full list:

| Route | LLM function | Rate limit type |
|-------|-------------|-----------------|
| /api/workshop/translate-line | translateLineInternal | checkDailyLimit |
| /api/workshop/translate-line-with-recipes | translateLineWithRecipesInternal | checkDailyLimit |
| /api/workshop/retry-line | translateLineWithRecipesInternal / translateLineInternal | checkRateLimit |
| /api/workshop/additional-suggestions | generateLineSuggestions | checkRateLimit |
| /api/workshop/line-suggestions | generateLineSuggestions | checkRateLimit |
| /api/workshop/token-suggestions | generateTokenSuggestions | checkRateLimit |
| /api/workshop/rhyme-workshop | responsesCall | checkRateLimit |
| /api/notebook/ai-assist | openai.chat.completions.create | checkDailyLimit |
| /api/notebook/poem-suggestions | responsesCall | checkRateLimit |
| /api/notebook/prismatic | openai.chat.completions.create | checkRateLimit |
| /api/notebook/suggestions | responsesCall | checkRateLimit |
| /api/journey/generate-reflection | openai.chat.completions.create | checkRateLimit |
| /api/journey/generate-brief-feedback | openai.chat.completions.create | checkRateLimit |
| /api/reflection/ai-assist-step-c | openai.chat.completions.create | checkDailyLimit |
| /api/verification/context-notes | openai.chat.completions.create | checkRateLimit |
| /api/verification/grade-line | openai.chat.completions.create | checkRateLimit |

Coverage: 16/16 (100%).

## Aggregated Telemetry

Telemetry is collected via `src/lib/telemetry/metricsCollector.ts`:
- Gated by `ENABLE_SCALABILITY_METRICS=1`.
- Events are sampled (configurable rate, default 10%) and aggregated in-memory.
- A batch-flush mechanism is defined (`registerFlushCallback`, `startMetricsFlush`) but is **not currently activated** — no call site registers a flush callback or starts the flush loop. When no callback is registered, the collector logs a notice and skips persistence. This infrastructure is available for future use when write-back to a telemetry store is needed.
- No raw per-request writes from hot paths.
- Isolated from `jobState` write flows.

Collected signals:
- Route latency (count, total, max, error count per route class).
- Token usage (prompt, completion per route class).
- Queue snapshots (peak depth, peak age, re-enqueue count, lock skip count).
- Cache hit/miss by key family.

## Scalability Baseline Method

Baseline measurements use frozen workload profiles defined in `docs/agent-temp/2026-03-13-scalability-validation-runbook.md`.
Results are recorded in `docs/agent-temp/baseline-artifact-template.md`.

Measurement windows:
- Each workload runs for 10 min sustained + 5 min recovery.
- 3 passes per workload before conclusions.
- Staging is the decision source of truth; local is sanity-check only.

Metrics collected per run:
- API latency (p50/p95) on status-read and translate routes.
- Queue depth, oldest age, drain time.
- Re-enqueue counts, lock skip/overlap, duplicate tick execution.
- Cache hit/miss by key family.
- Token usage and estimated cost per route class.
- Retry telemetry by layer.

## Operational Signals to Check First
- Health endpoints above
- Route logs around `translation-status`, `initialize-translations`, and verification routes
- Presence or absence of Redis configuration when queue/lock behavior looks wrong
- RPC availability if notebook note saves or guide-state patches fail

## Read Next
- `docs/reference/observability.md`
- `docs/03-guides/troubleshooting.md`
- `docs/guides/operations-runbook.md`
