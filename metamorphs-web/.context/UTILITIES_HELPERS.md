## UTILITIES_HELPERS

### 1) Utility functions and their purposes

- `lib/ai/cache.ts`: `stableHash`, `cacheGet`, `cacheSet` — in-memory cache with TTL
- `lib/ai/ratelimit.ts`: token bucket rate limiting
- `lib/ai/moderation.ts`: OpenAI moderation helper
- `lib/ai/openai.ts`: OpenAI client factory
- `lib/ai/prompts.ts`: translator system prompt
- `lib/apiGuard.ts`: Supabase-based auth guard for Next route handlers
- `lib/policy.ts`: feature and policy constants
- `lib/constraints.ts`: constraint enforcement stub
- `lib/generation.ts`: variant generator stub
- `lib/rag.ts`: retrieval stub
- `lib/models.ts`: model name mapping via env vars
- `lib/routers.tsx`: typed route builders and `<AppLink>`

### 2) Custom hooks

- `hooks/useThreadMessages.ts`: loads chat messages for a project/thread
- `hooks/useInterviewFlow.ts`: orchestrates flow mutations (start/answer/confirm/preview)
- `hooks/useProfile.ts`: profile load/save
- `hooks/useSupabaseUser.ts`: auth state

### 3) Constants and configurations

- Feature flags: `NEXT_PUBLIC_FEATURE_TRANSLATOR`, `NEXT_PUBLIC_FEATURE_ROUTER`, `NEXT_PUBLIC_FEATURE_ENHANCER`
- Policy constants in `lib/policy.ts` (rates, budgets, TTLs)

### 4) Type definitions/interfaces

- `types/workspace.ts`: `Version`, `CompareNode`, `JourneyItem`
- `types/sessionState.ts`: `SessionState`, `DecisionsItem`
- `types/llm.ts` (if present) for LLM types

### 5) Validation schemas

- Zod schemas in `lib/schemas.ts` for projects, threads, messages, versions, compares

### 6) Formatters and parsers

- `server/translator/parse.ts`: parses translator output into `{ lines, notes }`
- `server/translator/bundle.ts`: bundles state and inputs for translator
