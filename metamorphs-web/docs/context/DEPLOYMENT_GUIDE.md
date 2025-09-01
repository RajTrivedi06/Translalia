## Deployment Guide

### LLM Quick Reference

- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, feature flags (`NEXT_PUBLIC_FEATURE_*`), model envs (`TRANSLATOR_MODEL`, `ENHANCER_MODEL`, `EMBEDDINGS_MODEL`).
- Build: `npm run build`; Start: `npm run start`.
- Middleware sets Supabase session for SSR; routes rely on it.

### Context Boundaries

- Covers environment setup, builds, and runtime infra. Not an API reference.

### Environments

- Required secrets:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `OPENAI_API_KEY`
  - Optional: `TRANSLATOR_MODEL`, `ENHANCER_MODEL`, `EMBEDDINGS_MODEL`
  - Feature flags: `NEXT_PUBLIC_FEATURE_TRANSLATOR`, `NEXT_PUBLIC_FEATURE_ENHANCER`, `NEXT_PUBLIC_FEATURE_ROUTER`

### Build & Run

- Install deps: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`

### Infrastructure

- Next.js Node runtime; SSR + Route Handlers.
- Scaling: Prefer a shared cache/ratelimit (Redis) for multi-instance deployments.
- Health: add a simple health route (e.g., `/api/debug/whoami` for auth health in non-prod; production health should not expose user info).

### Database & Migrations

- Ensure `chat_threads.state jsonb` column exists (see `flags-and-models.md`).
- Recommended: adopt Supabase CLI migrations and version RLS policies.

### CI/CD

- Validate envs in CI; fail builds if required secrets missing.
- Run `npm run typecheck` and `npm run lint` before deploy.

### Security

- Do not expose debug routes in production.
- Restrict env visibility; keep `OPENAI_API_KEY` server-only.

### Code Generation Templates

```bash
# Production deploy (example generic)
export NEXT_PUBLIC_SUPABASE_URL=...
export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
export OPENAI_API_KEY=...
npm ci && npm run build && npm run start
```

### Related Files

- docs/context/SERVICES_INTEGRATIONS.md
- docs/flags-and-models.md
- docs/spend-and-cache-policy.md
