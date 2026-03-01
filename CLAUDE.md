# Claude Code Instructions

## What this file is for
Guidance for how Claude should work in this repository.

## When to read/use this
- Read when starting work.
- Revisit when deciding workflow or documentation updates.

## How Claude should work in this repo
- Prefer existing project patterns over inventing new ones.
- Keep changes scoped and easy to review.
- Use repository docs as source of truth for conventions.

## Preferred workflow
1. Read relevant docs in `docs/INDEX.md` and `docs/05-llm/DOC_MAP.md`.
2. Implement focused changes.
3. Verify behavior locally when possible.
4. Update permanent documentation only when requested.

## Where to look first
- Quick Start: `docs/00-start-here/quickstart.md`
- Architecture: `docs/01-architecture/system-overview.md`
- LLM Context Routing: `docs/05-llm/DOC_MAP.md`

## Temporary Documentation
- Use `temp-doc/` at repo root for temporary reports and investigations.
- Do not place temporary or WIP reports in `docs/`.
- Clean up `temp-doc/` periodically.

## Documentation Maintenance
- At the end of a work session, ask whether long-term docs should be updated.
- Wait for confirmation before editing permanent docs.
