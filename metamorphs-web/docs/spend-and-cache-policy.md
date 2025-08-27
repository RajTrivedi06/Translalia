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
