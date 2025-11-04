### [Last Updated: 2025-11-04]

## Deployment Guide

### Environments
- Dev: local Next.js dev server; process-memory cache; Redis quotas disabled (stub)
- Staging: optional; mirror prod envs with non-production keys
- Production: Node runtime, SSR + Route Handlers; ensure secrets configured

Required secrets
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`

Optional (models/flags)
- `TRANSLATOR_MODEL`, `ENHANCER_MODEL`, `EMBEDDINGS_MODEL`, `ROUTER_MODEL`
- UI/layout: `NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT` (V2 shell; "1" on, "0" off)
- Debug (dev only): `DEBUG_PROMPTS`, `NEXT_PUBLIC_DEBUG_PROMPTS`

### Build process
- Install: `npm install`
- Lint/types: `npm run lint && npm run typecheck`
- Build: `npm run build`
- Start: `npm run start`

```5:11:/Users/raaj/Documents/CS/metamorphs/translalia-web/package.json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "lint": "next lint"
}
```

### Environment-specific configuration
- Next config: security headers, image domains, ignore ESLint during builds
```3:10:/Users/raaj/Documents/CS/metamorphs/translalia-web/next.config.ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { domains: ["images.unsplash.com"] },
  eslint: { ignoreDuringBuilds: true },
}
```
- Middleware enforces auth on protected paths; redirects to sign-in if missing cookies
```27:41:/Users/raaj/Documents/CS/metamorphs/translalia-web/middleware.ts
const needsAuth = pathname.startsWith("/workspaces") || pathname.startsWith("/api/threads") || pathname.startsWith("/api/flow") || pathname.startsWith("/api/versions");
...
if (needsAuth && !hasSupabaseCookies) { /* redirect to sign-in with redirect param */ }
```

### CI/CD pipeline
- No CI pipelines committed in this repo snapshot (no .github/workflows/ or Jenkinsfile)
- Recommended steps:
  - Install deps (CI cache ideal)
  - `npm run lint && npm run typecheck`
  - `npm run build`
  - Smoke run with environment variables in a preview environment

### Deployment procedures
Generic Node host
```bash
# set envs (mask secrets!)
export NEXT_PUBLIC_SUPABASE_URL=...
export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
export OPENAI_API_KEY=...
# optional flags/models
export NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT=1

npm ci
npm run build
npm run start # by default on PORT=3000
```

Docker (example)
```Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY translalia-web/package*.json ./
RUN npm ci
COPY translalia-web/ .
RUN npm run build
EXPOSE 3000
CMD ["npm","run","start"]
```

### Rollback procedures
- UI-only rollback: set `NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT=0` and restart app to switch to legacy shell
- Full rollback: redeploy previous image/artifact; ensure envs unchanged

### Post-deployment verification
- Health: `GET /api/health` should return `{ ok: true }`
- Auth path: request to `/workspaces` without cookies should redirect to `/auth/sign-in`
- Supabase connectivity: create a thread via UI; verify `chat_threads` insert succeeds
- OpenAI: trigger `/api/notebook/prismatic` or `/api/guide/analyze-poem` with valid key; expect JSON response
- Uploads: list via `/api/uploads/list?threadId=...` returns items for the signed-in user

### Infrastructure requirements
- Node.js 18+ (20+ recommended)
- Single instance acceptable with in-memory cache; for multi-instance:
  - Externalize cache/quotas (Redis) for consistency and shared limits
  - Sticky sessions not required (SSR cookies via Supabase)
- Allow outbound HTTPS to Supabase and OpenAI

### Security
- Do not expose debug routes in production
- Keep `OPENAI_API_KEY` server-only; never in client bundle
- Ensure middleware matcher excludes static assets and images

### Database/Migrations
- Ensure `chat_threads.state jsonb` exists (server-owned state)
- Manage DDL/RLS through Supabase migrations (recommended); version and review changes with PRs

### References
- Services: `docs/context/SERVICES_INTEGRATIONS.md`
- Flags/Models: `docs/configuration/flags-and-models.md`
- Spend & Cache: `docs/policies/spend-and-cache-policy.md`
- LLM API: `docs/api/llm-api.md`
