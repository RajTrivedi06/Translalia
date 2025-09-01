## Security Guidelines

### LLM Quick Reference

- Always use `requireUser` for write routes; rely on Supabase RLS for row access.

### Input Validation & Sanitization

- Validate with Zod; reject unexpected types/fields.

### Auth & Authorization

- SSR cookies + optional Bearer token; do not trust client-only checks.
- Enforce RLS policies in DB for multi-tenant isolation.

### Secrets Management

- Keep `OPENAI_API_KEY` server-only; do not log it.

### Vulnerability Prevention

- Avoid echoing raw user content without escaping in UI.
- Do not persist flagged content (moderation gate on persistence).

### Guards & Middleware

- `middleware.ts` initializes session; `lib/apiGuard.ts` protects API handlers.

### Related Files

- docs/context/ARCHITECTURE_DECISIONS.md
- docs/moderation-policy.md
