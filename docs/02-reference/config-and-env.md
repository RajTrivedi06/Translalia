# Config and Environment

## What this file is for
Human-readable map of the repo’s configuration surface. For the full inventory, use `specs/config.schema.json`.

## Minimum Required Variables
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Important Rule
Most flags are string env vars, not booleans. The code distinguishes between:
- `"1"` and `"0"` for many feature/performance/debug flags
- `"true"` and `"false"` for verification feature flags and a few legacy values

## Groups

### Auth and Core Services
- `OPENAI_API_KEY`: required for all LLM-backed routes.
- `DEEPSEEK_API_KEY`: optional; required only when a `deepseek-*` model is selected on the Method 2 chat-completions path. Provider-routed via `getClientForModel` (`src/lib/ai/openai.ts`) against base URL `https://api.deepseek.com`. OpenAI behavior is byte-for-byte unchanged when no deepseek model is used.
- `DEEPSEEK_ALLOWED_EMAILS`: comma-separated email allowlist gating DeepSeek to approved accounts. Compared case-insensitively/trimmed against the authenticated user's email. Enforced server-side (403, no silent downgrade) at every generation route and inside `runTranslationTick` via the central `isDeepSeekAllowed`/`isDeepSeekBlocked` helpers (`src/lib/ai/deepseekAccess.ts`). Also backs `GET /api/features/deepseek` `{ allowed }` for the picker's conditional render, so the allowlist never ships to the client bundle. Unset/empty ⇒ DeepSeek is blocked for everyone.
- `NEXT_PUBLIC_SUPABASE_URL`: required by client, server, middleware, and auth fallbacks.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: required by client, server, middleware, and auth fallbacks.
- `SUPABASE_SERVICE_ROLE_KEY`: optional; only needed for privileged server-side operations.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`: optional in dev, but production queue/lock code assumes Redis is available when those features are used.
- `SENTRY_DSN`: optional verification error reporting hook.

### Model Selection
- `TRANSLATOR_MODEL`: default translation model; code fallback is `gpt-4o`.
- `ENHANCER_MODEL`: fallback is `gpt-5-mini`.
- `ROUTER_MODEL`: fallback is `gpt-5-nano-2025-08-07`.
- `EMBEDDINGS_MODEL`: fallback is `text-embedding-3-large`.
- `VERIFICATION_MODEL`: fallback is `gpt-5`.
- `CONTEXT_MODEL`: fallback is `gpt-5-mini`.

### Product and Feature Flags
- `NEXT_PUBLIC_FEATURE_ENHANCER`: `"1"` enables enhancer-related UI or route behavior.
- `NEXT_PUBLIC_FEATURE_TRANSLATOR`: `"1"` enables translator-facing UI or route behavior.
- `NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT`: `"1"` enables the sidebar layout variant.
- `NEXT_PUBLIC_FEATURE_VERIFICATION_INTERNAL`: `"true"` enables Track A verification wiring.
- `NEXT_PUBLIC_FEATURE_VERIFICATION_CONTEXT`: `"true"` enables Track B context-note wiring.
- `USE_SIMPLIFIED_PROMPTS`: set to `"1"` to run the simplified prompt path documented in ADR 0002. The code checks the explicit string and does not apply its own fallback.

### Runtime and URL Context
- `NEXT_PUBLIC_APP_URL`: used by routes that call back into the app; default fallback in code is `http://localhost:3000`.
- `NEXT_PUBLIC_UI_LANG_DEFAULT`: default locale fallback; code fallback is `en`.
- `NODE_ENV`, `VERCEL_ENV`, `VERCEL_REGION`: platform/runtime values used for guards and diagnostics.

### Translation Job and Queue Control
- `USE_REDIS_LOCK`: when `"true"`, Redis locking is required and the code fails fast if Redis is missing.
- `TRANSLATION_STATUS_TIMEOUT_MS`: short timeout for `/api/workshop/translation-status` (default: `300`).
- `TICK_TIME_BUDGET_MS`: translation tick budget passed to `runTranslationTick` from `translation-status` (default: `30000`). The background worker uses its own hardcoded budget (`15000` in `scripts/translation-worker.ts`), not this env var.
- `ENABLE_PARALLEL_STANZAS`, `MAX_STANZAS_PER_TICK` (default: `4`, cap `5`), `CHUNK_CONCURRENCY` (default: `3`, cap `5`): stanza/chunk scheduling controls.
- `MAIN_GEN_PARALLEL_LINES`, `MAIN_GEN_LINE_CONCURRENCY` (default: `6`, cap `8`): within-stanza line concurrency controls.
- `ENABLE_TICK_TIME_SLICING`: kill switch for time-sliced chunk processing.
- `MAX_REGEN_TIME_MS`, `MAX_REGEN_ROUNDS`: regen budget controls.
- `ENABLE_GPT5_REGEN_PARALLEL`, `GPT5_REGEN_K` (default: `2`), `GPT5_REGEN_CONCURRENCY` (default: `6`), `DEFAULT_REGEN_CONCURRENCY` (default: `3`): regen parallelism and candidate counts.

### Scalability and Queue Controls
- `ENABLE_STATUS_READ_ADVANCE_SPLIT`: when `"1"`, `translation-status` ignores `advance` param and serves read-only responses. Worker is sole advancement owner.
- `ENABLE_WORKER_ACTIVE_SET_GC`: set to `"0"` to disable worker startup active-set cleanup and periodic GC. Enabled by default.
- `WORKER_STALE_THRESHOLD_MS`: age threshold in milliseconds for active-set GC (default: `1800000` = 30 min).
- The two worker GC flags above are consumed by `translalia-web/scripts/translation-worker.ts`.
- `TRANSLATION_MAX_QUEUE_DEPTH`: max jobs allowed in the translation queue (default: `100`).
  Per-user admission control is not currently implemented; can be added later if usage patterns justify it.
- `MAX_POEM_LINES_FOR_TRANSLATION`: max poem lines accepted for translation (default: `200`).
- `ENABLE_SCALABILITY_METRICS`: when `"1"`, enables aggregated telemetry collection.
- `METRICS_FLUSH_INTERVAL_MS`: telemetry batch flush interval (default: `60000`).
- `METRICS_SAMPLE_RATE`: telemetry sampling rate for high-cardinality events (default: `0.1`).

### Rate Limits
- `SUGGESTIONS_RATE_LIMIT`
- `VERIFICATION_RATE_LIMIT`
- `CONTEXT_RATE_LIMIT`
- `WORKSHOP_RETRY_LINE_RATE_LIMIT`
- `NOTEBOOK_POEM_SUGGESTIONS_RATE_LIMIT`
- `NOTEBOOK_PRISMATIC_RATE_LIMIT`
- `JOURNEY_GENERATE_REFLECTION_RATE_LIMIT`
- `JOURNEY_GENERATE_BRIEF_FEEDBACK_RATE_LIMIT`

These are consumed as numeric strings.

### Prompt, Schema, and Gate Tuning
- `MAIN_GEN_MAX_OUTPUT_TOKENS` (default: `4000`, min `300`), `REGEN_MAX_OUTPUT_TOKENS` (default: `1500`, min `200`)
- `ENABLE_STRICT_JSON_SCHEMA`, `STRICT_JSON_SCHEMA_MODELS`, `STRICT_SCHEMA_FALLBACK_TO_JSON_OBJECT`
- `ENABLE_COMPRESSED_RECIPES`
- `ENABLE_LOCAL_ANCHOR_REALIZATIONS`
- `ALLOW_STOPWORD_ONLY_ANCHORS`, `STOPWORD_ALLOWED_ANCHORS`
- `ENABLE_GPT5_SAMPLING_TUNING`
- `ENABLE_STOP_SEQUENCES`
- `OMIT_SUBJECT_FORM_FROM_PROMPT`
- `FIDELITY_GATE_BLOCKING`
- `PERSIST_METHOD2_AUDIT`
- `PERSIST_SYNTHETIC_PERSONA`
- `LOG_CONTEXT_GENERATION`

### Diagnostics and Debug Logging
All of the following are code-backed debug toggles:
- `ENABLE_DIAGNOSTICS`: enabled by default unless explicitly set to `"false"` (`src/lib/diagnostics.ts`)
- `DEBUG_AUDIT`
- `DEBUG_ANCHOR_REALIZATIONS`
- `DEBUG_ANCHOR_VALIDATION`
- `DEBUG_GATE`
- `DEBUG_INVARIANTS`
- `DEBUG_LOCK`
- `DEBUG_MAIN_GEN_OUTPUT`
- `DEBUG_MONOTONICITY`
- `DEBUG_OAI_RAW_OUTPUT`
- `DEBUG_OUTPUT_MAX_CHARS`
- `DEBUG_OUTPUT_ON_PARSE_FAIL`
- `DEBUG_PHASE1`
- `DEBUG_PROMPT_SIZES`
- `DEBUG_RAW_COMPLETION`
- `DEBUG_RECIPES`
- `DEBUG_REGEN`
- `DEBUG_REGEN_OUTPUT`
- `DEBUG_RETRY`
- `DEBUG_SAMPLING`
- `DEBUG_SCHEMA`
- `DEBUG_STOP_SEQUENCES`
- `DEBUG_SUBJECT_FORM`
- `DEBUG_SUGGESTIONS`
- `DEBUG_TRANSLATION_STAGES`
- `DEBUG_VARIANTS`
- `DEBUG_API_ENABLED`: set to `"1"` only when you intentionally need debug endpoints outside local development.

### Test-Only
- `TEST_THREAD_ID`: referenced by `concurrentAuditTest.ts`; not required for normal app execution.

## Config Files
- `translalia-web/src/lib/env.ts`: minimal required-env helper for Supabase values.
- `translalia-web/src/lib/models.ts`: model defaults.
- `translalia-web/src/lib/featureFlags.ts`: feature-flag helpers.
- `translalia-web/next.config.ts`: build/runtime framework config.

## Read Next
- `specs/config.schema.json`
- `docs/reference/integrations.md`
- `docs/03-guides/troubleshooting.md`
