# Spend & Cache Policy (Phase 0)

- Rate limit (preview): 30 req/min per user.
- Soft daily budget (per project): $2 (block when exceeded).
- Cache identical previews by stable hash for 1 hour.
- Privacy: log usage only (provider, model, tokens, latency, cost, status, prompt hash). No raw prompts/outputs.
- Cache keys:
  - enhancer: `enhancer:<stableHash({ poem, fields })>`; TTL 3600s.
  - translator preview: `translate_preview:<stableHash(threadId + snapshot)>`; TTL 3600s.
- Budget attribution: per project_id where available; otherwise per user_id.
