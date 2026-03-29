# Troubleshooting Guide

## What this file is for
Fast checks for the most common failure modes visible in the repo.

## Common Failures

| Symptom | Check first | Likely cause |
| --- | --- | --- |
| Authenticated routes return `401` unexpectedly | `/api/auth/whoami`, `/api/debug/whoami`, cookie sync through `/api/auth` | Missing SSR cookie sync or no valid bearer token/session |
| Notebook note saves fail | `/api/debug/test-rpc` | `exec_sql` / `patch_thread_state_field` RPC missing |
| Translation jobs stall or never complete | Redis config, `/api/workshop/translation-status`, worker logs | lock contention, polling stopped, or Redis not configured for queue-backed flows |
| Method-2 output fails to parse | `DEBUG_SCHEMA`, `DEBUG_MAIN_GEN_OUTPUT`, `DEBUG_OUTPUT_ON_PARSE_FAIL` | prompt/schema mismatch or model output drift |
| Verification never triggers | `NEXT_PUBLIC_FEATURE_VERIFICATION_INTERNAL`, `/api/verification/health` | Track A flag disabled or save-line callback path misconfigured |
| Context notes unavailable | `NEXT_PUBLIC_FEATURE_VERIFICATION_CONTEXT`, context route rate limit | Track B disabled or rate-limited |
| Different thread shows stale UI state | thread id in URL vs Zustand persistence | thread-scoped persistence not rehydrated yet or wrong thread state restored |

## High-Value Checks
- `GET /api/health`
- `GET /api/verification/health`
- `GET /api/debug/env-check` in non-production
- `GET /api/debug/test-rpc` when atomic state updates look broken
- `npm run typecheck`
- `npm run build`

## Translation Pipeline Triage
1. Confirm the route path:
   - `method-1` -> `/api/workshop/translate-line`
   - `method-2` -> `/api/workshop/translate-line-with-recipes`
2. Confirm `USE_SIMPLIFIED_PROMPTS` is set the way you expect.
3. Check Redis-related flags if jobs or locks behave differently between dev and prod-like runs.
4. Check translation-status logs before assuming a UI bug; the route may be skipping because another tick holds the lock.

## Persistence Triage
- For guide and notebook note writes, prefer suspecting missing RPC support before suspecting UI state.
- For `workshop_lines` corruption or loss, inspect routes that rewrite the entire array.
- For missing diary entries, inspect the `diary_completed_poems` RPC conditions and whether every workshop line has non-empty `translated` content.

## When To Escalate to Code Reading
- When a failure depends on a specific JSONB path under `chat_threads.state`
- When a feature flag changes behavior but the route docs are ambiguous
- When a route works under bearer auth but not cookie auth, or vice versa

## Read Next
- `docs/02-reference/observability.md`
- `docs/02-reference/config-and-env.md`
- `translalia-web/docs/TRANSLATION_PIPELINE.md`
