## Testing Strategies

### LLM Quick Reference

- Test pure logic (questions/parse) with unit tests.
- Contract-test APIs: validate 4xx/5xx codes and shapes.
- Mock Supabase and OpenAI clients.

### Context Boundaries

- Covers testing approaches; does not duplicate API specs.

### Unit Testing

- Targets: `server/flow/questions.ts`, `server/translator/parse.ts`, helpers in `lib/*`.
- Patterns: arrange/act/assert; test invalid inputs and edge cases.

### Integration Testing

- Route handlers with mocked Supabase and OpenAI.
- Validate status codes: 400/401/403/404/409/429/502.

### End-to-End (optional)

- Happy paths: sign-in → start flow → answer → confirm → preview → accept-lines.

### Fixtures & Mocks

- Create minimal thread/project fixtures in a test schema or via Supabase test project.
- Mock OpenAI chat completions to return deterministic outputs.

### Performance Tests

- Measure translator preview latency and cache hit rates.

### Related Files

- docs/flow-api.md
- docs/llm-api.md
