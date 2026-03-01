# Agent Instructions

## What this file is for
Primary entry point for AI agents working in this repository.

## When to read/use this
- Read first when starting work in this repo.
- Re-check when unsure about workflow, conventions, or where docs live.

## Project Summary
This repository contains the Translalia project workspace, with the runnable web application in `translalia-web/` and supporting project-level documentation at the repository root.

## Golden Commands
### Web App (from `translalia-web/`)
- `npm install` - Install dependencies.
- `npm run dev` - Start local development server.
- `npm run build` - Build for production.
- `npm run start` - Run production build locally.

## Non-negotiables / Do Not
- Do not commit secrets or real credentials.
- Do not add dependencies without updating the relevant lockfile.
- Do not place temporary investigations inside `docs/`.

## Repo Navigation
- Documentation Index: `docs/INDEX.md`
- LLM Routing Map: `docs/05-llm/DOC_MAP.md`
- Quick Start: `docs/00-start-here/quickstart.md`
- Architecture Overview: `docs/01-architecture/system-overview.md`

## Project Structure
```text
AIDCPT/
├── translalia-web/
├── docs/
├── specs/
├── temp-doc/
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

## Workflow Expectations
1. Read relevant docs before making changes.
2. Follow existing project patterns.
3. Verify changes locally where possible.
4. Keep docs and references in sync with structural changes.
