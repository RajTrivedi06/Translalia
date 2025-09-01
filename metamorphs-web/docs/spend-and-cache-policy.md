# Spend & Cache Policy (current)

- Rate limit (preview): 30 req/min per user.
- Soft daily budget (per project): $2 (block when exceeded).
- Cache identical previews by stable hash for 1 hour.
- Privacy: log usage only (provider, model, tokens, latency, cost, status, prompt hash). No raw prompts/outputs.
- Cache keys:
  - enhancer: `enhancer:<stableHash({ poem, fields })>`; TTL 3600s.
  - translator preview: `translator_preview:<stableHash(bundle)>`; TTL 3600s.
- Budget attribution: per project_id where available; otherwise per user_id.
- Journey Activity: no caching (RLS lists are user-specific and small; rely on query invalidations after actions).

Notes:

- Preview route verifies persistence (fails loudly if RLS blocks update) and still returns `preview` for optimistic UI.
- Nodes API is thread-scoped; clients invalidate `['nodes', threadId]` after mutations.

---

## Invalidation & TTLs

- Enhancer and preview caches use fixed TTL of 3600s. Invalidate by changing inputs (poem, fields, accepted lines, ledger notes).
- Do not cache journey or nodes responses; these are time-sensitive and scoped by thread/project.

## Cost Optimization Patterns

- Prefer cached previews; avoid re-calling LLMs for identical inputs.
- Choose lower-cost models for planning steps (enhancer) and reserve higher-quality models for final generation.
- Limit prompt sizes: trim summaries and ledger notes to the most recent items.

## Alerts & Notifications (future)

- Add server-side counters per project/day; emit alerts at 50%, 75%, 100% of budget.
- Disable expensive endpoints when budget exceeded; return 402/403 with guidance.

## Cache Warming & Preloading (suggested)

- After plan confirm, pre-warm translator preview for better UX when phase flips to translating.

## Cost Management Implementation Guide (LLM)

- Wrap LLM calls with `stableHash` and `cacheGet/cacheSet`.
- Surface token `usage` in API responses where possible; aggregate per project.
- Enforce per-thread or per-project rate limits on hot endpoints.

## Reporting & Monitoring (future)

- Track per-project spend approximations using token usage and published model pricing.
- Build dashboards for cache hit rate, average latency, and error distribution.
