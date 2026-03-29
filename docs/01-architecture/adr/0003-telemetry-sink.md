# ADR 0003: Aggregated Postgres Metrics Sink for Scalability Telemetry

## Status
Accepted

## Context
The scalability investigation requires queryable telemetry to establish baselines and enforce SLOs. Existing instrumentation (`openaiInstrumentation.ts`, `retryTelemetry.ts`, `runTranslationTick.ts`) logs structured data to stdout but is not durably queryable.

The primary constraint is that the application's main bottleneck investigation centers on DB write pressure around `jobState.ts` (high-churn JSONB in `chat_threads.state`). Writing raw per-request telemetry into the same Postgres instance could distort baselines and amplify the very pressure being measured.

## Decision
Use structured Postgres metrics tables in Supabase as the telemetry sink, but only with aggregated/sampled/batched writes:

- Fixed sampling policy (default 10%) for high-cardinality request events.
- In-memory aggregation buffer with periodic batch flush (default 60s).
- Pre-aggregated rows per route class, not one row per request.
- Telemetry writes are isolated from `jobState` hot-write flows.
- Gated by `ENABLE_SCALABILITY_METRICS` flag — can be disabled instantly if write amplification appears.

## Options Considered

### Option A: Raw per-request Postgres writes
- Pros: Full fidelity, simple implementation.
- Cons: Creates the write pressure being investigated. Unbounded row growth. Distorts baseline measurements.

### Option B: External monitoring backend (e.g., Datadog, Grafana Cloud)
- Pros: No impact on application DB. Purpose-built for metrics.
- Cons: Adds external dependency. Cost. Operational overhead disproportionate for 5-20 user scale.

### Option C: Log export + dashboard pipeline
- Pros: No application DB impact.
- Cons: Requires log aggregation infrastructure. Fragile parsing. Not queryable from application code.

### Option D (chosen): Aggregated/sampled Postgres writes
- Pros: No external dependency. Queryable with SQL. Bounded write volume. Gated and reversible.
- Cons: Lower fidelity than raw writes. Requires sampling tuning. Same DB host (mitigated by low write volume and isolation).

## Consequences

### Positive
- Telemetry is queryable without new infrastructure.
- Write volume is bounded and predictable.
- Can be disabled instantly via feature flag.

### Negative
- Sampled data loses individual request detail (acceptable for aggregate SLOs).
- Shares the Supabase Postgres instance (mitigated by batch/aggregate approach and monitoring for DB p95 impact).

### Neutral
- Sampling rate and flush interval may need tuning based on Phase 0 baseline data.

## Links
- Metrics collector: `translalia-web/src/lib/telemetry/metricsCollector.ts`
- SLOs: `docs/02-reference/observability.md`
- Cache coherence audit: `docs/agent-temp/cache-coherence-audit.md`
- Redis fallback triage: `docs/agent-temp/redis-fallback-triage.md`
