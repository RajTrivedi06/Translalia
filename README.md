Updated: 2025-11-04

## Translalia

A decolonial, AI‑assisted creative poetry translation workspace. The web app (Next.js) helps poets and translators explore variants, compare versions, and refine translations with LLM assistance.

### Core features

- AI‑assisted translation flows (preview, instruct, translate)
- Enhancement planning via an enhancer endpoint (flag‑gated)
- Optional verification/back‑translation (flag‑gated)
- Supabase auth with SSR cookie sync
- Rich notebook/workshop UI with versioning and comparisons

### Tech stack

- Next.js 15 (App Router), React 19
- TanStack Query (data fetching/caching)
- Zustand (client state)
- Supabase (auth + client/server helpers)
- OpenAI SDK (Responses/Chat)

```34:43:/Users/raaj/Documents/CS/metamorphs/translalia-web/package.json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "15.4.6",
    "react": "19.1.0",
    "openai": "^4.104.0"
  }
```

### Prerequisites

- Node.js 18+ (20+ recommended)
- npm (repo uses `package-lock.json`)
- OpenAI API key
- Supabase project (URL + anon key)

### Quick start

1. Clone and enter the web app

```bash
git clone <your-fork-or-repo>
cd metamorphs/translalia-web
npm install
```

2. Configure environment (names only; do not commit secrets)

Create `.env.local` in `translalia-web/` with at least:

```bash
OPENAI_API_KEY=sk-****...abcd
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....
```

Optional flags (set to `"1"` to enable):

```bash
NEXT_PUBLIC_FEATURE_TRANSLATOR=1
NEXT_PUBLIC_FEATURE_ENHANCER=1
NEXT_PUBLIC_FEATURE_VERIFY=0
NEXT_PUBLIC_FEATURE_BACKTRANSLATE=0
NEXT_PUBLIC_FEATURE_PRISMATIC=0
# Debug logging of prompts (redacts secrets in logs)
DEBUG_PROMPTS=0
NEXT_PUBLIC_DEBUG_PROMPTS=0
# Service role key only if you know what you are doing (server‑side)
SUPABASE_SERVICE_ROLE_KEY=
```

3. Run the app

```bash
npm run dev
# opens http://localhost:3000
```

### Usage examples

- Sign up or sign in (Supabase auth flow)
- Create/open a workspace, paste source text
- Use translator preview or instruct to iterate on candidates
- Toggle feature flags for enhancer/verify/back‑translate if needed

### Project structure

- `translalia-web/` — Next.js web app (all runnable code lives here)
  - `src/app/` — routes, API handlers, layouts
  - `src/components/` — UI components (notebook, workshop, chat, etc.)
  - `src/lib/` — clients, env, feature flags, LLM helpers
  - `src/hooks/`, `src/store/`, `src/types/` — hooks, state, types
- `docs/` — architecture, API, policies, and style guide
- `metamorphs-web/` — placeholder (no content yet)

### Commands

- Install: `cd translalia-web && npm install`
- Develop: `npm run dev`
- Build: `npm run build`
- Start (prod): `npm run start`

These commands are defined in the app’s `package.json` and align with the current lockfiles.

### Environment variables (names only)

- Required: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Optional server key: `SUPABASE_SERVICE_ROLE_KEY`
- Feature flags: `NEXT_PUBLIC_FEATURE_TRANSLATOR`, `NEXT_PUBLIC_FEATURE_ENHANCER`, `NEXT_PUBLIC_FEATURE_VERIFY`, `NEXT_PUBLIC_FEATURE_BACKTRANSLATE`, `NEXT_PUBLIC_FEATURE_PRISMATIC`
- Debug: `DEBUG_PROMPTS`, `NEXT_PUBLIC_DEBUG_PROMPTS`

```56:66:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
```

```57:61:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/generate-reflection/route.ts
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
```

### Links to documentation

- App README: `translalia-web/README.md`
- Docs index: `docs/README.md`
- Architecture and codebase overview: `docs/context/CODEBASE_OVERVIEW.md`
- API routes: `docs/context/API_ROUTES.md`, `docs/api/flow-api.md`, `docs/api/llm-api.md`
- Deployment guide: `docs/context/DEPLOYMENT_GUIDE.md`
- Policies: `docs/policies/moderation-policy.md`, `docs/policies/spend-and-cache-policy.md`
- Style guide: `docs/STYLE.md`

### Notes

- This repo’s root `package.json` only declares shared types (`zod`); the runnable app is under `translalia-web/`.
- Never commit secrets. Provide variable names only; redact any sample values.
