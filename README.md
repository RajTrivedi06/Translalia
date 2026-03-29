# Translalia Workspace

Translalia is an AI-assisted poetry translation workspace. The runnable application lives in `translalia-web/`; the repository root owns the canonical documentation, agent routing, and machine-readable specs.

## Start here
- App setup: `docs/00-start-here/quickstart.md`
- Command reference: `docs/00-start-here/dev-commands.md`
- Architecture overview: `docs/01-architecture/system-overview.md`
- API reference: `docs/02-reference/api.md`
- Config and env: `docs/02-reference/config-and-env.md`
- Agent routing: `docs/05-llm/DOC_MAP.md`
- OpenAPI: `specs/openapi.yaml`
- Config schema: `specs/config.schema.json`

## Quick start
Run the app from `translalia-web/`:

```bash
npm install
npm run dev
```

Minimum environment required to boot is documented in `docs/00-start-here/quickstart.md`. The short version is:
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Common local additions:
- `USE_SIMPLIFIED_PROMPTS=1`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Repo layout
- `translalia-web/` runnable Next.js application
- `docs/` canonical repository documentation
- `specs/` machine-readable API and config contracts
- `AGENTS.md` and `CLAUDE.md` agent entry instructions

## Documentation policy
- Root `docs/` is canonical.
- `translalia-web/docs/` is app-local deep reference only.
- Temporary investigations belong only in `docs/agent-temp/`.
