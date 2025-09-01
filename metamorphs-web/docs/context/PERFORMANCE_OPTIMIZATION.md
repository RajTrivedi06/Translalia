## Performance Optimization

### LLM Quick Reference

- Cache identical LLM requests; limit bundle sizes; use lower-cost models for planning.

### Bottlenecks & Solutions

- Nodes polling (1.5s): consider backoff or user-triggered refresh
- Translator preview latency: cache and reduce prompt size

### Caching Strategies

- In-memory TTL (3600s) for enhancer and preview

### DB Optimization

- Index filters used frequently: `(project_id)`, `(thread_id)`, `(created_at)`
- Composite indexes: `(project_id, created_at)` on `versions`/`journey_items`

### Frontend Patterns

- Use React Query for caching and background refetch
- Keep components pure; lift effects into hooks

### Monitoring

- Track cache hit rate, request latencies, and error rates

### Related Files

- docs/spend-and-cache-policy.md
- docs/context/DATABASE_SCHEMA.md
