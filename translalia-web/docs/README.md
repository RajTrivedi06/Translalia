# Translalia Web Deep References

## What this file is for
Defines the role of `translalia-web/docs/` after the documentation rebuild.

## When to read/use this
- Read this directory only after `docs/INDEX.md` or `docs/05-llm/DOC_MAP.md` routes you here.
- Use it for prompt internals, translation pipeline debugging, and app-local LLM behavior.
- Do not use it as the canonical source for setup, architecture, API coverage, or env/config.

## Canonical docs live at the repo root
- `docs/INDEX.md` for navigation
- `docs/00-start-here/quickstart.md` for setup
- `docs/01-architecture/system-overview.md` for runtime boundaries
- `docs/02-reference/api.md` for route coverage
- `docs/02-reference/config-and-env.md` for env/config
- `docs/05-llm/DOC_MAP.md` for agent task routing

## Files kept here
- `PROMPTS.md` for the current prompt-family map, source files, routes, contracts, and rollback notes
- `TRANSLATION_PIPELINE.md` for the active workshop translation path and batch job flow
- `LLM_CONTEXT.md` for deprecated historical terminology only

## Read order
1. Start with `docs/05-llm/DOC_MAP.md`.
2. Open `PROMPTS.md` if the task is prompt- or model-related.
3. Open `TRANSLATION_PIPELINE.md` if the task is workshop translation, retries, or job-state debugging.
4. Open `LLM_CONTEXT.md` only when tracing legacy terminology still present in old code comments or notes.
