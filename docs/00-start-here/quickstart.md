# Quickstart

## What this file is for
Minimal, verified path from clone to a running local app.

## Scope
- This repo is a workspace.
- The runnable app lives in `translalia-web/`.
- Root docs are canonical; app-local docs are deep references.

## Prerequisites
- Node.js 18+; Node.js 20+ is the safer default for Next.js 15 and the current toolchain.
- `npm`; the app uses `translalia-web/package-lock.json`.
- A Supabase project with URL and anon key.
- An OpenAI API key.

## First Run
1. From the repo root, install app dependencies:
   `cd translalia-web && npm install`
2. Create `translalia-web/.env.local`.
3. Set the minimum required variables:

```bash
OPENAI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. Start the dev server:
   `npm run dev`
5. Open `http://localhost:3000`.

## Optional But Common Local Variables
- `TRANSLATOR_MODEL` to change the default translation model.
- `USE_SIMPLIFIED_PROMPTS=1` to keep the current default path explicit.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` if you want Redis-backed locks/queues locally.
- `NEXT_PUBLIC_FEATURE_TRANSLATOR=1`, `NEXT_PUBLIC_FEATURE_ENHANCER=1`, `NEXT_PUBLIC_FEATURE_VERIFICATION_INTERNAL=true`, `NEXT_PUBLIC_FEATURE_VERIFICATION_CONTEXT=true` to expose gated UI or backend behaviors.

## Verification
- `GET /api/health` returns `{"ok":true,"ts":...}`.
- If auth is configured correctly, signing in should allow `GET /api/auth/whoami` to return `{ ok: true, userId }`.
- If `.env.local` is incomplete, server routes that touch OpenAI or Supabase will fail quickly.

## Read Next
- `docs/00-start-here/dev-commands.md`
- `docs/02-reference/config-and-env.md`
- `docs/01-architecture/system-overview.md`
- `docs/03-guides/troubleshooting.md`
