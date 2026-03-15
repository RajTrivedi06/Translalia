# Translalia Web

Next.js application for the Translalia translation workspace.

## Use this file for
- the shortest path to run the app locally
- app-local links back to canonical repo docs

## Run locally
From `translalia-web/`:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Minimum local env
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Common local additions:
- `USE_SIMPLIFIED_PROMPTS=1` to activate the simplified Method 2 prompt branch
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for queueing, locks, and rate limiting

Do not treat this README as the full env reference. Use `../docs/02-reference/config-and-env.md` for the complete surface and `../specs/config.schema.json` for the machine-readable contract.

## Canonical docs
- `../docs/INDEX.md`
- `../docs/00-start-here/quickstart.md`
- `../docs/01-architecture/system-overview.md`
- `../docs/02-reference/api.md`
- `../docs/05-llm/DOC_MAP.md`

## App-local deep references
- `docs/PROMPTS.md`
- `docs/TRANSLATION_PIPELINE.md`
- `docs/README.md`

## Notes
- The repo uses npm and `package-lock.json`.
- Root-level docs own architecture, API, config, and agent navigation.
- `translalia-web/docs/LLM_CONTEXT.md` is deprecated and should not be loaded first.
