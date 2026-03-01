# Documentation Index

## What this file is for
Central navigation hub for project documentation.

## When to read/use this
- Start here when looking for any project documentation.
- Use this page to locate architecture, guides, and reference docs quickly.

## Canonical Documentation Rule
- Numbered directories (`00-*` to `05-*`) are the canonical, workflow-oriented docs.
- Named directories (`guides/`, `reference/`, `decisions/`, `ai/`) are category-oriented companions.
- If pages overlap, prefer the numbered docs first.

## Start Here
- `docs/00-start-here/quickstart.md` - Local setup and first run.
- `docs/00-start-here/dev-commands.md` - Common development commands.

## Architecture
- `docs/01-architecture/system-overview.md` - High-level system structure.
- `docs/01-architecture/data-flow.md` - Core data and request flows.
- `docs/01-architecture/adr/0001-template.md` - ADR template for architecture decisions.

## Reference
- `docs/02-reference/api.md` - API overview and contract pointers.
- `docs/02-reference/database.md` - Database and schema reference.
- `docs/02-reference/config-and-env.md` - Config and environment variables.
- `docs/02-reference/observability.md` - Logs, metrics, and health signals.

## Guides
- `docs/03-guides/add-endpoint.md` - How to add a backend endpoint.
- `docs/03-guides/add-migration.md` - How to add a database migration.
- `docs/03-guides/add-component.md` - How to add a frontend component.
- `docs/03-guides/troubleshooting.md` - Common issues and fixes.

## LLM Context
- `docs/05-llm/DOC_MAP.md` - Task-to-document routing for AI agents.
- `docs/05-llm/context-packs/frontend-pack.md` - Frontend context pack.
- `docs/05-llm/context-packs/backend-pack.md` - Backend context pack.
- `docs/05-llm/context-packs/db-pack.md` - Database context pack.

## Project-Level Docs
- `docs/project-brief.md` - Product and project intent.
- `docs/architecture.md` - Short architecture narrative.
- `docs/roadmap.md` - Milestones and future work outline.

## Additional Categories
- `docs/guides/` - Additional operational and process guides.
- `docs/reference/` - Additional domain and contract references.
- `docs/decisions/` - Decision logs and ADR tracking.
- `docs/ai/` - Alternate AI context documentation.
