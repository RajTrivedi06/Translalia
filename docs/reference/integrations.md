---
title: Integrations
tags: [area:reference, audience:developers, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# Integrations

## External Services

| Service | Used for | Main env/config |
| --- | --- | --- |
| Supabase | auth, database access, SSR session helpers | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional `SUPABASE_SERVICE_ROLE_KEY` |
| OpenAI | translation, notebook suggestions, reflection, verification | `OPENAI_API_KEY`, model env vars |
| Upstash Redis | rate limiting, locks, queues, cache | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `USE_REDIS_LOCK` |
| Datamuse | rhyme lookup | no dedicated env in repo |

## Integration Notes
- Supabase is both the auth boundary and the primary persistence layer.
- Redis is optional in some dev paths but materially changes behavior for queue-backed work.
- OpenAI usage is spread across route handlers and lower-level pipeline helpers.
- Datamuse is isolated to rhyme-support logic.

## Read Next
- `docs/02-reference/config-and-env.md`
- `docs/02-reference/database.md`
