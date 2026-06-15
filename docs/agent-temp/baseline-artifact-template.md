# Scalability Baseline Artifact

## Run Metadata

| Field | Value |
|-------|-------|
| Date | |
| Run number | 1 / 2 / 3 |
| Environment | local / staging |
| Worker version | (git SHA) |
| Web app version | (git SHA) |
| Active-set state at start | translation: 0, alignment: 0 |
| Notes | |

## Frozen Workload Profiles

| Workload | Poem size | Concurrent pollers | Concurrent jobs | Duration | Recovery window |
|----------|-----------|-------------------|-----------------|----------|-----------------|
| W1-small | ~12 lines | 3 | 1 | 10 min | 5 min |
| W2-medium | ~40 lines | 10 | 3 | 10 min | 5 min |
| W3-large | ~120 lines | 20 | 5 | 10 min | 5 min |

## API Latency

| Route | Workload | p50 (ms) | p95 (ms) | Error rate (%) | Sample count |
|-------|----------|----------|----------|----------------|--------------|
| /api/workshop/translation-status (advance=true) | W1 | | | | |
| /api/workshop/translation-status (advance=true) | W2 | | | | |
| /api/workshop/translation-status (advance=true) | W3 | | | | |
| /api/workshop/translate-line-with-recipes | W1 | | | | |
| /api/workshop/translate-line-with-recipes | W2 | | | | |
| /api/notebook/poem-suggestions | W1 | | | | |
| /api/notebook/ai-assist | W1 | | | | |

## Queue and Worker Metrics

| Metric | Workload | Value | Notes |
|--------|----------|-------|-------|
| Peak queue depth (translation) | W1 | | |
| Peak queue depth (translation) | W2 | | |
| Peak queue depth (translation) | W3 | | |
| Queue oldest age (ms) | W2 | | |
| Queue drain time after load (s) | W2 | | |
| Re-enqueue count per job (avg) | W2 | | |
| Lock skip count (tick overlap) | W2 | | |
| Duplicate tick executions | W2 | | Should be 0 |

## Cache Performance

| Cache layer | Key family | Hit rate (%) | Miss count | TTL | Notes |
|-------------|-----------|-------------|------------|-----|-------|
| Redis | recipe:* | | | | |
| Redis | cache:llm:* | | | | |
| Redis | translation:queue:active | | | n/a | |
| React Query | translation-job | | | staleTime=0 | |
| React Query | guide-state | | | staleTime=5m | |
| React Query | context-notes | | | staleTime=1h | |

## Token Usage and Cost

| Route class | Calls | Prompt tokens | Completion tokens | Total tokens | Est. cost ($) |
|-------------|-------|---------------|-------------------|--------------|---------------|
| Workshop (translate-line-with-recipes) | | | | | |
| Workshop (additional-suggestions) | | | | | |
| Workshop (retry-line) | | | | | |
| Notebook (poem-suggestions) | | | | | |
| Notebook (ai-assist) | | | | | |
| Notebook (prismatic) | | | | | |
| Journey (generate-reflection) | | | | | |
| Journey (generate-brief-feedback) | | | | | |
| Reflection (ai-assist-step-c) | | | | | |
| Verification (grade-line) | | | | | |
| Verification (context-notes) | | | | | |

## Retry Telemetry

| Layer | Attempts | Retries | Total delay (ms) | Last error reason |
|-------|----------|---------|------------------|-------------------|
| recipe-gen | | | | |
| main-gen | | | | |
| regen | | | | |
| parse | | | | |

## Bottleneck Ranking

| Rank | Bottleneck | Evidence | Impact | Priority |
|------|-----------|----------|--------|----------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

## Phase 3/4 Gate Decision

### Phase 3 (JSONB Migration): GO / NO-GO / DEFER

Rationale:

### Phase 4 (Cost Governance): GO / NO-GO / DEFER

Rationale:
