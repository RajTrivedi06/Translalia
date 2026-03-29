# Backend Context Pack

## Load This For
- API route work under `translalia-web/src/app/api`
- translation pipeline changes
- auth, rate limiting, and backend persistence behavior

## Open These Files First
- `translalia-web/src/lib/auth/requireUser.ts`
- `translalia-web/src/lib/apiGuard.ts`
- `translalia-web/src/app/api/workshop/translate-line-with-recipes/route.ts`
- `translalia-web/src/app/api/workshop/initialize-translations/route.ts`
- `translalia-web/src/app/api/workshop/translation-status/route.ts`
- `translalia-web/src/lib/translation/method2/translateLineWithRecipesInternal.ts`
- `translalia-web/src/lib/workshop/runTranslationTick.ts`

## Backend Invariants
- Every non-debug route should make auth and ownership boundaries explicit.
- OpenAI-backed routes should be rate-limited.
- Method-2 is the operationally preferred translation path; method-1 remains only for legacy/rollback compatibility.
- `USE_SIMPLIFIED_PROMPTS=1` is the intended simplified-prompt operating mode; the code path is explicitly env-controlled.
- Translation jobs depend on bounded work, per-thread locks, and queue reconciliation.

## Persistence and Safety
- `chat_threads` is the central entity for translation state.
- Atomic JSONB patching matters; avoid new read-modify-write helpers for single-path state updates.
- Redis is optional in some dev paths but significant for production-like queue and lock behavior.

## Supporting Deep References
- `translalia-web/docs/TRANSLATION_PIPELINE.md`
- `translalia-web/docs/PROMPTS.md`
- `docs/01-architecture/adr/0002-simplified-prompts.md`

## Read Next
- `docs/02-reference/api.md`
- `docs/02-reference/config-and-env.md`
- `docs/03-guides/add-endpoint.md`
