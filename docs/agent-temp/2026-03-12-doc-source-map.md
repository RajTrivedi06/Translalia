# Documentation Source Map

## Purpose
Map each permanent documentation area to the most relevant code-backed sources.

## Canonical docs

| Doc target | Primary source files |
| --- | --- |
| `docs/00-start-here/quickstart.md` | `translalia-web/package.json`, `translalia-web/README.md`, `translalia-web/src/lib/env.ts`, `translalia-web/src/app/api/health/route.ts` |
| `docs/00-start-here/dev-commands.md` | `translalia-web/package.json`, `translalia-web/scripts/*`, test files under `src/lib/workshop` |
| `docs/01-architecture/system-overview.md` | `translalia-web/src/app`, `translalia-web/src/components`, `translalia-web/src/store`, `translalia-web/src/lib`, `translalia-web/src/server` |
| `docs/01-architecture/data-flow.md` | `src/app/api/auth/route.ts`, `src/app/api/projects/route.ts`, `src/app/api/threads/*.ts`, `src/app/api/workshop/*.ts`, `src/app/api/notebook/*.ts`, `src/app/api/journey/*.ts`, `src/app/api/verification/*.ts` |
| `docs/02-reference/api.md` | `translalia-web/src/app/api/**/route.ts`, `src/types/*`, `src/lib/schemas.ts` |
| `docs/02-reference/config-and-env.md` | `translalia-web/src/lib/env.ts`, `src/lib/models.ts`, `src/lib/featureFlags.ts`, `rg process.env` inventory |
| `docs/02-reference/database.md` | `translalia-web/supabase/migrations/*.sql`, Supabase usage across `src/app/api`, `src/server/guide/updateGuideState.ts` |
| `docs/02-reference/observability.md` | `src/app/api/health/route.ts`, `src/app/api/verification/health/route.ts`, `src/app/api/debug/*.ts`, `src/server/audit/*`, `src/lib/verification/*` |
| `docs/03-guides/*` | Matching implementation files plus route and store patterns |
| `docs/05-llm/*` | `translalia-web/docs/PROMPTS.md`, `translalia-web/docs/TRANSLATION_PIPELINE.md`, ADR 0002, `src/lib/ai/*`, `src/lib/translation/method2/*`, `src/store/*`, `src/lib/hooks/*` |

## Companion docs

| Companion doc | Canonical parent |
| --- | --- |
| `docs/reference/api-contracts.md` | `docs/02-reference/api.md` |
| `docs/reference/auth-rbac.md` | `docs/02-reference/api.md`, `docs/02-reference/database.md` |
| `docs/reference/domain-model.md` | `docs/02-reference/database.md` |
| `docs/reference/db-mapping.md` | `docs/02-reference/database.md` |
| `docs/reference/integrations.md` | `docs/01-architecture/system-overview.md`, `docs/02-reference/config-and-env.md` |
| `docs/reference/observability.md` | `docs/02-reference/observability.md` |
| `docs/reference/seo-aeo.md` | `docs/01-architecture/system-overview.md` |
| `docs/guides/dev-setup.md` | `docs/00-start-here/quickstart.md` |
| `docs/guides/testing.md` | `docs/00-start-here/dev-commands.md` |
| `docs/guides/deployment.md` | `docs/02-reference/config-and-env.md`, `translalia-web/BUILD_SANITY_CHECK.md` |
| `docs/guides/operations-runbook.md` | `docs/02-reference/observability.md`, `docs/03-guides/troubleshooting.md` |
