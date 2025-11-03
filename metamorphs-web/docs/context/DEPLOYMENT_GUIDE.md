### [Last Updated: 2025-09-16]

## Deployment Guide

### LLM Quick Reference

- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, feature flags (`NEXT_PUBLIC_FEATURE_*`), model envs (`TRANSLATOR_MODEL`, `ENHANCER_MODEL`, `EMBEDDINGS_MODEL`).
- Build: `npm run build`; Start: `npm run start`.
- Middleware sets Supabase session for SSR; routes rely on it. Auth cookies are synchronized via `/api/auth` handler when client auth state changes.

### Context Boundaries

- Covers environment setup, builds, and runtime infra. Not an API reference.

### Environments

- Required secrets:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `OPENAI_API_KEY`
  - Optional: `TRANSLATOR_MODEL`, `ENHANCER_MODEL`, `EMBEDDINGS_MODEL`
  - Feature flags: `NEXT_PUBLIC_FEATURE_TRANSLATOR`, `NEXT_PUBLIC_FEATURE_ENHANCER`, `NEXT_PUBLIC_FEATURE_ROUTER`
  - Optional flags: `NEXT_PUBLIC_FEATURE_PRISMATIC`, `NEXT_PUBLIC_FEATURE_VERIFY`, `NEXT_PUBLIC_FEATURE_BACKTRANSLATE`
  - UI layout flag: `NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT` (V2 shell). Set to "1" to enable, "0" to use legacy shell.

### Feature Flag Toggles (rollout/rollback)

- `NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT`

  - When "1": Thread route renders the V2 two-column shell (`WorkspaceV2Shell`).
  - When "0": Legacy `WorkspaceShell` remains.
  - Reversible rollout; no database migrations required.

- `NEXT_PUBLIC_FEATURE_CHAT_FIRST`

  - When "1": Enables Chat-First surface (full-screen chat shell) as a UI-only swap.
  - When "0": Uses standard center flow (Chat → Line Selection → Workshop → Notebook).
  - Reversible; no database migrations required.

- `NEXT_PUBLIC_FEATURE_EXPLODE_DRAWER`
  - When "1": Enables Explode tokens drawer in Workshop; drawer is focus-trapped.
  - When "0": Drawer and related token UI remain hidden.
  - Reversible; no database migrations required.

### Environment Variables (YAML for LLM consumption)

```yaml
env_vars:
  - name: NEXT_PUBLIC_SUPABASE_URL
    purpose: Supabase project URL (used client and server)
    required: true
  - name: NEXT_PUBLIC_SUPABASE_ANON_KEY
    purpose: Supabase anon key for client and SSR session
    required: true
  - name: OPENAI_API_KEY
    purpose: Server-side OpenAI API key for moderation and translator
    required: true
  - name: TRANSLATOR_MODEL
    purpose: Override translator model
    required: false
    default: gpt-5
  - name: ENHANCER_MODEL
    purpose: Override enhancer model
    required: false
    default: gpt-5-mini
  - name: EMBEDDINGS_MODEL
    purpose: Override embeddings model
    required: false
    default: text-embedding-3-large
  - name: NEXT_PUBLIC_FEATURE_TRANSLATOR
    purpose: Enable translator UI/routes when set to "1"
    required: false
  - name: NEXT_PUBLIC_FEATURE_ENHANCER
    purpose: Enable enhancer UI/routes when set to "1"
    required: false
  - name: NEXT_PUBLIC_FEATURE_ROUTER
    purpose: Enable server-side intent routing when set to "1"
    required: false
  - name: NEXT_PUBLIC_FEATURE_PRISMATIC
    purpose: Enable prismatic translator mode when set to "1"
    required: false
  - name: NEXT_PUBLIC_FEATURE_VERIFY
    purpose: Enable verifier tools when set to "1"
    required: false
  - name: NEXT_PUBLIC_FEATURE_BACKTRANSLATE
    purpose: Enable back-translation when set to "1"
    required: false
  - name: UPSTASH_REDIS_REST_URL
    purpose: Redis (Upstash) REST endpoint for daily rate limits
    required: false
  - name: UPSTASH_REDIS_REST_TOKEN
    purpose: Redis (Upstash) REST token for daily rate limits
    required: false
```

### Deployment Checklist

- Build artifacts:
  - [ ] `npm run lint && npm run typecheck`
  - [ ] `npm run build`
- Envs configured (see YAML above):
  - [ ] Supabase URL + anon key
  - [ ] OpenAI API key (server-only)
  - [ ] Feature flags as needed
  - [ ] `NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT` set appropriately; toggle to rollback UI layout if needed
  - [ ] Optional Redis (Upstash) for daily limits
- Database:
  - [ ] `chat_threads.state jsonb` present; RLS policies applied
- Runtime:
  - [ ] Node runtime set; process memory cache acceptable for single instance
  - [ ] Consider Redis-backed cache/ratelimit for multi-instance scaling
- Security:
  - [ ] Disable debug routes in production
  - [ ] Restrict env exposure; never expose `OPENAI_API_KEY` client-side
  - [ ] Middleware auth guard in place (see anchor below)

### Middleware Auth/Session Anchors

```5:13:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/middleware.ts
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll() { return req.cookies.getAll(); }, setAll(c) { /* ... */ } },
    }
  );
```

```27:43:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/middleware.ts
const needsAuth = pathname.startsWith("/workspaces") || pathname.startsWith("/api/threads") || pathname.startsWith("/api/flow") || pathname.startsWith("/api/versions");
const hasSupabaseCookies = Array.from(req.cookies.getAll()).some((c) => c.name.startsWith("sb-") || c.name.includes("supabase"));
if (needsAuth && !hasSupabaseCookies) {
  const url = new URL("/auth/sign-in", origin);
  url.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}
```

### Build & Run

- Install deps: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`

### Infrastructure

- Next.js Node runtime; SSR + Route Handlers.
- Scaling: Prefer a shared cache/ratelimit (Redis) for multi-instance deployments.
- Health: add a simple health route (e.g., `/api/debug/whoami` for auth health in non-prod; production health should not expose user info).
- Middleware matcher excludes static assets and images (see `middleware.ts`).

### Database & Migrations

- Ensure `chat_threads.state jsonb` column exists (see `flags-and-models.md`).
- Recommended: adopt Supabase CLI migrations and version RLS policies.

### CI/CD

- Validate envs in CI; fail builds if required secrets missing.
- Run `npm run typecheck` and `npm run lint` before deploy.

### Security

- Do not expose debug routes in production.
- Restrict env visibility; keep `OPENAI_API_KEY` server-only.
- Ensure `middleware.ts` enforces auth on `/workspaces`, `/api/threads`, `/api/flow`, `/api/versions` when no Supabase cookies present (redirects to sign-in with redirect param).

### Code Generation Templates

```bash
# Production deploy (example generic)
export NEXT_PUBLIC_SUPABASE_URL=...
export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
export OPENAI_API_KEY=...
npm ci && npm run build && npm run start
```

### Related Files

- docs/context/SERVICES_INTEGRATIONS.md
- docs/flags-and-models.md
- docs/spend-and-cache-policy.md

### Rollback

- To restore legacy workspace UI instantly, set `NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT=0` and redeploy.
- The overlay components are migrated to shadcn-style wrappers for a11y but remain API-compatible; no server changes are involved.
