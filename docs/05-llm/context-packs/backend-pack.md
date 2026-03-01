# Backend Context Pack

## What this file is for
Dense context for translation APIs, LLM orchestration, and backend conventions.

## When to read/use this
- Use for tasks in `translalia-web/src/app/api` and server/LLM utility code.

## Backend Stack Snapshot
- Runtime: Next.js route handlers (Node/Edge as configured per route).
- Data/Auth: Supabase (Postgres + auth integration).
- LLM: OpenAI SDK with JSON-first structured responses.
- Reliability controls: rate limiting, caching, lock-based recipe generation, retry/regeneration gates.

## Key API Domains
- `workshop` APIs: line translation, initialization jobs, suggestions, persistence.
- `notebook` APIs: prismatic and notebook-side AI assist flows.
- `journey` APIs: reflection/feedback generation.
- `verification` APIs: grading and analysis.
- `diary` APIs: completed poem archive and retrieval.

## Translation Method Context
- Method 1 exists as legacy literalness-spectrum generation.
- Method 2 is primary: recipe-aware prismatic generation with A/B/C archetypes.
- Method 2 pipeline includes recipe fetch/generate, main generation, diversity gate, and alignment pass.

## API and Error Patterns
- Keep auth and input validation at API boundaries.
- Prefer consistent JSON response shapes and explicit error messages.
- Preserve non-blocking/background job behavior for batch translation flows.

## Performance and Safety Guardrails
- Use bounded parallelism and budgeted work/ticks for large translation workloads.
- Keep caching/rate-limit settings explicit and controllable via env flags.
- Preserve distinctness checks and contrastive regeneration to avoid near-duplicate variants.
