# Documentation Index

## What this file is for
Canonical navigation hub for repository documentation. Start here before loading deeper docs into an agent context window.

## Canonical Rule
- Numbered directories (`00-*` through `05-*`) own the topic.
- Named directories (`guides/`, `reference/`, `decisions/`, `ai/`) extend or mirror the numbered docs; they do not replace them.
- App-local docs in `translalia-web/docs/` are deep references for LLM and pipeline work only.

## Fastest Paths

| Task | Read first | Read next |
| --- | --- | --- |
| Boot the app locally | `docs/00-start-here/quickstart.md` | `docs/00-start-here/dev-commands.md` |
| Understand the system | `docs/01-architecture/system-overview.md` | `docs/01-architecture/data-flow.md` |
| Find an API or route | `docs/02-reference/api.md` | `specs/openapi.yaml` |
| Find env flags or model defaults | `docs/02-reference/config-and-env.md` | `specs/config.schema.json` |
| Find tables, RPCs, or state fields | `docs/02-reference/database.md` | `docs/reference/db-mapping.md` |
| Add a feature safely | `docs/03-guides/add-endpoint.md` or `docs/03-guides/add-component.md` | matching reference doc |
| Debug agent context loading | `docs/05-llm/DOC_MAP.md` | one relevant context pack |

## Canonical Sections

### `00-start-here`
- `docs/00-start-here/quickstart.md` - exact npm-based local setup path
- `docs/00-start-here/dev-commands.md` - verified commands from `translalia-web/package.json`

### `01-architecture`
- `docs/01-architecture/system-overview.md` - runtime boundaries and key directories
- `docs/01-architecture/data-flow.md` - request and state flows worth preserving
- `docs/01-architecture/adr/0002-simplified-prompts.md` - accepted translation-pipeline decision
- `docs/01-architecture/adr/0003-telemetry-sink.md` - aggregated Postgres metrics sink decision
- `docs/01-architecture/adr/0004-poll-queue-decoupling.md` - status poll/advance split and queue controls
- `docs/01-architecture/adr/0001-template.md` - template for future ADRs

### `02-reference`
- `docs/02-reference/api.md` - route catalog and route classifications
- `docs/02-reference/config-and-env.md` - env/config surface grouped by effect
- `docs/02-reference/database.md` - confirmed tables, RPCs, and JSONB state fields
- `docs/02-reference/observability.md` - health endpoints, debug routes, audits, and telemetry

### `03-guides`
- `docs/03-guides/add-endpoint.md` - route implementation pattern
- `docs/03-guides/add-migration.md` - Supabase migration and RPC pattern
- `docs/03-guides/add-component.md` - UI placement, state, and query guidance
- `docs/03-guides/troubleshooting.md` - common failure patterns and checks

### `05-llm`
- `docs/05-llm/DOC_MAP.md` - task router for agent context loading
- `docs/05-llm/context-packs/frontend-pack.md` - UI/store-oriented context pack
- `docs/05-llm/context-packs/backend-pack.md` - route/pipeline-oriented context pack
- `docs/05-llm/context-packs/db-pack.md` - DB/state-oriented context pack

## Project and Compatibility Docs
- `docs/project-brief.md` - short product and repo context
- `docs/architecture.md` - thin landing page to the canonical architecture docs
- `docs/roadmap.md` - only repo-verifiable active themes
- `docs/README.md` - compatibility entrypoint for tools that expect `docs/README.md`
- `docs/ai/context-pack.md` - compatibility wrapper for older AI-doc references

## Companion Directories
- `docs/reference/` - detailed expansions that stay subordinate to `docs/02-reference/`
- `docs/guides/` - deeper operational setup, testing, deployment, and runbooks
- `docs/decisions/` - ADR index and decision tracking

## App-Local Deep References
- `translalia-web/docs/README.md` - explains when to use the app-local docs
- `translalia-web/docs/PROMPTS.md` - prompt-family map, not canonical repo routing
- `translalia-web/docs/TRANSLATION_PIPELINE.md` - method-2 pipeline reference
- `translalia-web/docs/LLM_CONTEXT.md` - deprecated legacy deep reference

## Agent Temp Rules
- Agent-generated investigation output belongs only in `docs/agent-temp/`.
- Temporary docs are for evidence gathering and review, not canonical project guidance.
