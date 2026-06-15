# Stale Doc Gap List

## Permanent docs that were placeholders
- `docs/00-start-here/quickstart.md`
- `docs/00-start-here/dev-commands.md`
- `docs/01-architecture/system-overview.md`
- `docs/01-architecture/data-flow.md`
- `docs/02-reference/api.md`
- `docs/02-reference/config-and-env.md`
- `docs/02-reference/database.md`
- `docs/02-reference/observability.md`
- `docs/03-guides/add-endpoint.md`
- `docs/03-guides/add-migration.md`
- `docs/03-guides/add-component.md`
- `docs/03-guides/troubleshooting.md`
- `docs/project-brief.md`
- `docs/roadmap.md`
- Most companion `docs/reference/*` and `docs/guides/*` files
- `docs/ai/context-pack.md`
- `specs/openapi.yaml`
- `specs/config.schema.json`

## App-local docs that were stale relative to code
- `translalia-web/docs/PROMPTS.md` still described prompt bodies inline and leaned on the legacy archetype system.
- `translalia-web/docs/TRANSLATION_PIPELINE.md` still described the archetype-based recipe path as the primary flow.
- `translalia-web/README.md` still used `pnpm` even though `translalia-web/package-lock.json` and `package.json` indicate npm.

## Repo entrypoints that needed sync
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/INDEX.md`
- `docs/05-llm/DOC_MAP.md`
