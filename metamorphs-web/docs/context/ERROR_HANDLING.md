## Error Handling

### LLM Quick Reference

- Use Zod for request validation; return 400 with `.flatten()`.
- Auth failures: 401; feature-off: 403; state conflicts: 409; rate limit: 429; parse errors: 502.

### Context Boundaries

- Focuses on patterns and status codes; see API docs for routes.

### Classification

- 4xx: client errors (validation, auth, feature flags, state)
- 5xx: server/infra errors (DB, unexpected, LLM parse when non-recoverable → 502)

### Patterns

- Guard early: `requireUser` for protected routes
- Validate body/query with Zod; include helpful messages
- Never leak DB internals in messages

### Logging & Monitoring

- Capture status codes and latencies; include token usage where relevant
- Avoid storing PII/raw prompts; prefer hashed inputs

### User-Facing Messages

- Short, actionable errors; suggest next steps

### Recovery

- Cache and rate-limit to reduce failure surfaces
- Retry idempotent endpoints (preview) on transient errors

### Related Files

- docs/llm-api.md
- docs/flow-api.md
