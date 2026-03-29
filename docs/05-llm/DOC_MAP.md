# LLM Documentation Map

## What this file is for
Task router for agents. Load the smallest set of docs that answers the task.

## Rules
- Start from one canonical doc and one context pack when possible.
- Do not load app-local deep references unless the task is explicitly about prompts or the translation pipeline.
- Treat `translalia-web/docs/LLM_CONTEXT.md` as legacy reference-only.

## Routing Table

| Task | Load first | Then load | Avoid unless needed |
| --- | --- | --- | --- |
| Local setup or environment failure | `docs/00-start-here/quickstart.md` | `docs/02-reference/config-and-env.md` | app-local prompt docs |
| System architecture | `docs/01-architecture/system-overview.md` | `docs/01-architecture/data-flow.md` | companion docs |
| Add or change an API route | `docs/02-reference/api.md` | `docs/03-guides/add-endpoint.md`, `docs/05-llm/context-packs/backend-pack.md` | `translalia-web/docs/LLM_CONTEXT.md` |
| Add or change a frontend component | `docs/03-guides/add-component.md` | `docs/05-llm/context-packs/frontend-pack.md` | backend/deep prompt docs |
| Schema or RPC work | `docs/02-reference/database.md` | `docs/03-guides/add-migration.md`, `docs/05-llm/context-packs/db-pack.md` | unrelated UI docs |
| Translation pipeline debugging | `docs/05-llm/context-packs/backend-pack.md` | `translalia-web/docs/TRANSLATION_PIPELINE.md` | unrelated companion guides |
| Prompt-family change | `docs/05-llm/context-packs/backend-pack.md` | `translalia-web/docs/PROMPTS.md`, ADR 0002 | legacy LLM context unless rollback details matter |
| State-clobber or persistence bug | `docs/02-reference/database.md` | `docs/05-llm/context-packs/db-pack.md`, `docs/03-guides/troubleshooting.md` | landing-page docs |

## Context Packs
- `docs/05-llm/context-packs/frontend-pack.md`
- `docs/05-llm/context-packs/backend-pack.md`
- `docs/05-llm/context-packs/db-pack.md`

## Legacy and Compatibility
- `docs/ai/context-pack.md` is a compatibility wrapper only.
- `translalia-web/docs/LLM_CONTEXT.md` should only be opened when a task explicitly needs legacy prompt-system archaeology or cross-checking old notes.

## Agent Temp Rules
- Put temporary investigations and evidence docs only in `docs/agent-temp/`.

## Related Entrypoints
- `docs/INDEX.md`
- `AGENTS.md`
- `CLAUDE.md`
