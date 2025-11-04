### [Last Updated: 2025-11-04]

## Testing Strategies

### Current tooling status
- No test runner or browser E2E framework is configured in `package.json` (no `test` script, no Jest/Vitest/Playwright deps)
```1:11:/Users/raaj/Documents/CS/metamorphs/translalia-web/package.json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "lint": "next lint"
}
```
- CI: no workflows committed; tests do not run in CI today

### Recommended setup (proposal)
- Unit/Integration: Vitest + TS + ts-dom for small DOM utilities
- API route integration: Supertest on Next Route Handlers via Next testing utilities or spin up dev server with fetch against localhost
- E2E: Playwright (headed/headless) for critical flows
- Coverage: `c8` with targets listed below

Add scripts (proposal):
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "playwright test",
    "coverage": "vitest run --coverage"
  }
}
```

### Organization (proposal)
- Tests colocated next to modules: `*.test.ts` for units; `*.spec.ts` for route integrations under `src/app/api/**`
- E2E under `e2e/` with Playwright fixtures

### Unit testing patterns and targets
- Pure logic helpers: hashing, rate limit math, selection reducers
```5:11:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/cache.ts
export function stableHash(obj: unknown): string { /* sorted keys, sha256 */ }
```
```1:16:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/ratelimit.ts
export function rateLimit(key: string, limit = 30, windowMs = 60_000) { /* window */ }
```
- Store reducers and actions: notebook mutations, guide merges
```436:450:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/notebookSlice.ts
if (p.meta?.threadId && p.meta.threadId !== tid) { /* discard persisted */ }
return { ...current, ...p, hydrated: true, meta: { threadId: tid } };
```

Example test (vitest sketch):
```ts
import { describe, it, expect } from "vitest";
import { stableHash } from "@/lib/ai/cache";

describe("stableHash", () => {
  it("hashes with deterministic key ordering", () => {
    const a = stableHash({ b: 1, a: 2 });
    const b = stableHash({ a: 2, b: 1 });
    expect(a).toBe(b);
  });
});
```

### Integration testing approach (API)
- Route handlers: validate status codes and envelopes, mocking external services
```8:15:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/projects/route.ts
const parsed = createProjectSchema.safeParse(await req.json());
if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
```
- Auth variants: cookie vs Bearer
```12:22:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/apiGuard.ts
export async function requireUser(req: NextRequest): Promise<GuardOk | GuardFail> { /* cookie → bearer */ }
```
- Caching and rate-limiting behaviors
```101:109:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
const cached = await cacheGet<AIAssistResponse>(cacheKey);
if (cached) { return NextResponse.json(cached); }
```
```83:99:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
const rateCheck = await checkDailyLimit(/* ... */);
if (!rateCheck.allowed) { return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }); }
```

### E2E testing strategy (proposal)
- Critical paths:
  - Sign-in → list threads → create thread → open → send chat → see message
  - Guide: set poem → analyze → see JSON analysis persisted
  - Notebook: locks update → verify persisted state via API
- Use Playwright fixtures for Supabase auth (seed via API or stub session cookies in dev-only build)

### Coverage goals (proposal)
- Unit: ≥ 70% statements/branches in `lib/**` and `store/**`
- Routes: smoke coverage for all `src/app/api/**` handlers; happy path + major error branches (401/403/404/409/429/500/502)
- E2E: 3 critical flows per release

### Mocking strategies
- OpenAI: mock `openai.chat.completions.create` and `openai.responses.create` to return deterministic JSON blocks
```147:156:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
messages: [ { role: "system", content: system }, { role: "user", content: userPrompt } ]
```
- Supabase: mock `createServerClient` and client methods (`auth.getUser`, `from().select().single()`, etc.)
- Rate limit/cache: inject stubs or reset in beforeEach

### CI/CD test execution
- Today: none. Recommended pipeline steps:
  - Install deps (cache)
  - `npm run lint && npm run typecheck`
  - `npm run test` (Vitest)
  - `npm run test:ui` (Playwright) on main/nightly only

### Running tests locally (proposal)
- Unit/integration:
  - `npm run test` (after adding Vitest)
- E2E:
  - `npm run dev` in one terminal, then `npm run test:ui` (after adding Playwright)
- Env notes:
  - For API tests, set dummy `OPENAI_API_KEY` and stub OpenAI client; for Supabase, either mock client or point to test project with RLS relaxed

### Appendices: key anchors for assertions
- Retry-After support
```13:23:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/http/errors.ts
export function jsonError(status: number, message: string, opts?: { retryAfterSec?: number }) {
  const res = NextResponse.json({ error: message }, { status });
  if (opts?.retryAfterSec) { res.headers.set("Retry-After", String(opts.retryAfterSec)); }
  return res;
}
```
- Model fallback logic (assert path switch)
```200:238:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
if (shouldFallback) { /* switch to gpt-4o */ } else { return err(502, "OPENAI_FAIL", /* ... */); }
```
- Thread‑aware persistence merge
```446:450:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/notebookSlice.ts
if (p.meta?.threadId && p.meta.threadId !== tid) {
  return { ...current, hydrated: true, meta: { threadId: tid } };
}
```
