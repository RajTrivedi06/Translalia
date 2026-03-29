# Claude Code Instructions

## What this file is for
Repository-specific guidance for Claude Code and similar coding agents.

## Read first
- `docs/INDEX.md`
- `docs/05-llm/DOC_MAP.md`
- `docs/00-start-here/quickstart.md`
- `docs/01-architecture/system-overview.md`

## Working rules
- Use root `docs/` as the canonical documentation set.
- Use `translalia-web/docs/` only for prompt and translation-pipeline deep references.
- Put temporary notes, inventories, and investigation outputs only in `docs/agent-temp/`.
- Prefer concise cross-links to duplicated prose.

## When code changes require doc updates
- API route/interface change: update `docs/02-reference/api.md` and `specs/openapi.yaml`
- Env/config change: update `docs/02-reference/config-and-env.md` and `specs/config.schema.json`
- Translation or prompt-path change: update `docs/05-llm/DOC_MAP.md` and the relevant file in `translalia-web/docs/`

## Commands
From `translalia-web/`:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run start`

## Documentation maintenance
- Do not load deprecated docs first just because they are longer.
- Reconcile docs with current code before adding new narrative.
- Keep permanent docs agent-focused: concrete paths, contracts, invariants, flags, and next files to open.
