# LLM Documentation Map

## What this file is for
Task-based routing guide for AI agents to load the minimum useful docs quickly.

## When to read/use this
- Read at the beginning of an AI-assisted task.
- Use when deciding which docs to load into context.

## Task Routing
- Onboarding/setup: `docs/00-start-here/quickstart.md` then `docs/00-start-here/dev-commands.md`.
- Architecture/design: `docs/01-architecture/system-overview.md` and `docs/01-architecture/data-flow.md`.
- API implementation: `docs/02-reference/api.md`, `docs/03-guides/add-endpoint.md`, then backend context pack.
- Frontend/workshop UI changes: `docs/03-guides/add-component.md` then frontend context pack.
- Database/schema changes: `docs/02-reference/database.md`, `docs/03-guides/add-migration.md`, then db context pack.
- Translation pipeline tuning: backend context pack + `translalia-web/docs/TRANSLATION_PIPELINE.md`.
- Prompt or variant-behavior changes: frontend and backend context packs + `translalia-web/docs/PROMPTS.md`.
- LLM legacy deep dive: `translalia-web/docs/LLM_CONTEXT.md` (deprecated, reference-only).

## Context Packs
- `docs/05-llm/context-packs/frontend-pack.md`
- `docs/05-llm/context-packs/backend-pack.md`
- `docs/05-llm/context-packs/db-pack.md`

## Related Entrypoints
- `docs/INDEX.md`
- `AGENTS.md`
- `CLAUDE.md`
