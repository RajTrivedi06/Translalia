# Agent Instructions

## What this file is for
Primary entry point for coding agents working in this repository.

## When to read/use this
- Read first when starting work.
- Re-check when unsure which docs are canonical or where temporary outputs belong.

## Project summary
- Runnable app: `translalia-web/`
- Canonical docs: `docs/`
- Machine-readable contracts: `specs/openapi.yaml`, `specs/config.schema.json`

## First files to open
- `docs/INDEX.md`
- `docs/05-llm/DOC_MAP.md`
- `docs/00-start-here/quickstart.md`
- `docs/01-architecture/system-overview.md`

## Golden commands
From `translalia-web/`:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run start`

## Documentation rules
- Treat root `docs/` as canonical.
- Treat `translalia-web/docs/` as deep reference only.
- Do not create temporary or investigative docs outside `docs/agent-temp/`.
- When changing API coverage, update both `docs/02-reference/api.md` and `specs/openapi.yaml`.
- When changing env/config behavior, update both `docs/02-reference/config-and-env.md` and `specs/config.schema.json`.
- Prefer links and cross-references over duplicating the same explanation in multiple files.

## Non-negotiables
- Do not commit secrets or real credentials.
- Do not add dependencies without updating the relevant lockfile.
- Do not treat deprecated docs as canonical just because they are verbose.

## Repo structure
```text
AIDCPT/
├── translalia-web/
├── docs/
│   └── agent-temp/
├── specs/
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

## Workflow expectations
1. Read the smallest relevant doc set first.
2. Verify behavior against code before updating permanent docs.
3. Keep canonical docs, deep references, and specs consistent.
4. Leave temporary investigation outputs in `docs/agent-temp/` only.
