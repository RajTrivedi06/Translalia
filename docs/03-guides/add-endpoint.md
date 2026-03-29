# Add Endpoint Guide

## What this file is for
Implementation pattern for adding or changing an API route in `translalia-web/src/app/api`.

## Use This Pattern
1. Put the route under `translalia-web/src/app/api/<domain>/<name>/route.ts`.
2. Decide which guard matches the route shape:
   - use `src/lib/auth/requireUser.ts` for App Router style handlers that do not need the raw `NextRequest` in the guard
   - use `src/lib/apiGuard.ts` when the route already centers on `NextRequest`
3. Validate request input with `zod`.
   - Reuse `src/lib/schemas.ts` if the schema is already generic.
   - Otherwise define a route-local schema near the handler.
4. Perform ownership checks explicitly even when using a Supabase session client.
5. Reuse existing response patterns:
   - `400` for validation failures
   - `401` for missing auth
   - `403` for ownership/authorization failures
   - `404` for missing resources
   - `429` for rate limits
   - `500` or `502` for internal or upstream failures

## Where To Put Shared Logic
- Request/response types: `translalia-web/src/types`
- Generic validation schemas: `translalia-web/src/lib/schemas.ts`
- Shared DB/auth helpers: `translalia-web/src/lib`
- Long-running or stateful orchestration: `translalia-web/src/lib/workshop`, `translalia-web/src/lib/translation`, or `translalia-web/src/server`

## When To Use Rate Limiting
- Add rate limiting for any route that hits OpenAI or expensive derived processing.
- Current patterns live in `src/lib/ratelimit/redis.ts`.
- Use `checkDailyLimit()` or `checkRateLimit()` depending on whether the route is keyed by day or TTL window.

## State-Write Rules
- If the route updates `chat_threads.state` at one JSONB path, prefer atomic patching via `patchThreadStateField()`.
- Do not introduce a new read-modify-write helper for thread-state patching.
- If the route rewrites a whole JSONB field intentionally, document why concurrency is acceptable.

## Documentation Update Checklist
- Add or update the route in `docs/02-reference/api.md`.
- Update `specs/openapi.yaml`.
- If the route introduces new env/config, update `docs/02-reference/config-and-env.md` and `specs/config.schema.json`.
- If the route changes data shape or storage, update `docs/02-reference/database.md`.

## Validation Checklist
- Route returns the right status codes for auth, validation, and ownership failures.
- Route works with cookie auth and does not break bearer-token fallback if the code path uses it.
- Any new OpenAI route is rate-limited and has bounded failure behavior.
- Any new persistent state write is documented and concurrency-reviewed.

## Read Next
- `docs/02-reference/api.md`
- `docs/reference/api-contracts.md`
- `specs/openapi.yaml`
