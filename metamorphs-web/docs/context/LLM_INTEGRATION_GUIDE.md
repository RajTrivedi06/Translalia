### [Last Updated: 2025-09-16]

## LLM Integration Guide

### Purpose

How to use this documentation set to generate accurate code across APIs, flows, services, and UI.

### Navigation

- API endpoints: `docs/context/API_ROUTES.md`, `docs/llm-api.md`, `docs/flow-api.md`
- Data schema: `docs/context/DATABASE_SCHEMA.md`
- Components: `docs/context/COMPONENTS_STRUCTURE.md`
- Services: `docs/context/SERVICES_INTEGRATIONS.md`
- Policies: `docs/moderation-policy.md`, `docs/spend-and-cache-policy.md`, `docs/flags-and-models.md`
- State & relationships: `docs/context/STATE_MANAGEMENT.md`, `docs/context/RELATIONSHIPS.md`

### Code Generation Templates

```ts
// Protected route handler template
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";
import { z } from "zod";

const Body = z.object({
  /* fields */
});
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (guard.res) return guard.res;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  // ... business logic
  return NextResponse.json({ ok: true });
}
```

```ts
// LLM call with cache + validation (responses.create)
import { getOpenAI } from "@/lib/ai/openai";
import { stableHash, cacheGet, cacheSet } from "@/lib/ai/cache";
import { SomeZodSchema } from "@/types/llm";

const key = "prefix:" + stableHash(payload);
const cached = await cacheGet(key);
if (cached) return cached;
const client = getOpenAI();
const resp = await client.responses.create({
  model,
  input: [
    { role: "system", content: system },
    { role: "user", content: user },
  ],
  ...(json ? { response_format: { type: "json_object" } } : {}),
});
const parsed = SomeZodSchema.safeParse(parseRaw(resp));
if (!parsed.success)
  return NextResponse.json({ error: "LLM output invalid" }, { status: 502 });
await cacheSet(key, parsed.data, 3600);
```

### Rate Limit & Cache Keys

- Preview: rate limit key `preview:${threadId}`; cache key `translator_preview:` + stable hash of bundle (may include placeholder id in code paths to reflect persisted overview).

```55:59:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
if (!rl.ok)
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

```153:161:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const key = "translator_preview:" + stableHash({ ...bundle, placeholderId });
const cached = await cacheGet<unknown>(key);
if (cached) {
  // flip placeholder to generated from cached value
  ...
}
```

### Cookies and Auth

- Client posts auth changes to `/api/auth`; middleware ensures SSR cookies for protected routes; use `requireUser` for write routes.

```20:27:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/auth/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { event, session } = body as {
    event?: SupabaseAuthEvent;
    session?: SupabaseSessionPayload;
  };
  const res = NextResponse.json({ ok: true });
```

```12:20:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/apiGuard.ts
export async function requireUser(
  req: NextRequest
): Promise<GuardOk | GuardFail> {
  // 1) Try cookie-bound session via App Router helper
  console.log("[requireUser] starting");
  try {
    const cookieStore = await cookies();
```

### Relationship to Docs

- Use API routes docs for shapes and statuses; DB schema for columns and relations; policies for gating and cost controls.

### Quality Guardrails

- Always validate inputs and outputs (Zod).
- Use `requireUser` and respect feature flags.
- Prefer caches and rate limits on hot endpoints.

### Checklist: Adding a new LLM surface

- Auth: gate with `requireUser` or public as intended.
- Rate limit: apply `rateLimit(key, limit, windowMs)` for hot endpoints.
- Cache: compute deterministic key via `stableHash(payload)`; write `cacheGet`/`cacheSet`.
- Responses API: use `getOpenAI().responses.create` and honor JSON `response_format` when structured output is required.
- Prompt hash: compute and log using `buildPromptHash` and `logLLMRequestPreview`.

Anchors:

```3:13:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/ratelimit.ts
export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
```

```13:21:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/cache.ts
export async function cacheGet<T>(key: string): Promise<T | null> {
  const item = mem.get(key);
  if (!item) return null;
```

```100:110:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/promptHash.ts
export function logLLMRequestPreview(args: LogArgs) {
  const DEBUG =
    process.env.DEBUG_PROMPTS === "1" ||
    process.env.NEXT_PUBLIC_DEBUG_PROMPTS === "1";
  if (!DEBUG) return;
  // Avoid printing full poem/user content in logs
  console.info("[LLM]", {
    route: args.route,
    model: args.model,
    hash: args.hash,
```

### Bad vs Good

- Bad: persisting model text without validation, calling LLM on every keystroke, ignoring 401/403.
- Good: schema-validated outputs, idempotent cached calls, explicit HTTP status handling.

### Journey Context in Prompts

Updated: 2025-09-16

The translator bundle collects recent journey items scoped to the active thread using a `meta->>thread_id` filter, then both Preview and Instruct append a JOURNEY block to the user prompt.

Evidence (bundle query and return):

```57:66:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/translator/bundle.ts
// Fetch recent journey items scoped to this thread
const { data: jrows } = await supabase
  .from("journey_items")
  .select("id, kind, summary, created_at, meta")
  .filter("meta->>thread_id", "eq", threadId)
  .order("created_at", { ascending: false })
  .limit(5);
```

```66:83:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/translator/bundle.ts
const journeySummaries = (jrows || []).map((r) => {
  const s = String(r.summary || "").replace(/\s+/g, " ").slice(0, 200);
  const maybeLen = (r.meta as { selections?: { length?: number } } | undefined)?.selections?.length;
  const linesCount = typeof maybeLen === "number" ? ` (lines: ${maybeLen})` : "";
  return `${r.kind || "activity"}: ${s}${linesCount}`;
});
```

Insertion into prompts:

```228:234:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
bundle.journeySummaries?.length
  ? "JOURNEY (most recent → older):\n" +
    bundle.journeySummaries.map((s) => `- ${s}`).join("\n")
  : "",
```

```194:201:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
bundle.journeySummaries?.length
  ? "JOURNEY (most recent → older):\n" +
    bundle.journeySummaries.map((s) => `- ${s}`).join("\n")
  : "",
```

Mini example (format only):

```
JOURNEY (most recent → older):
- accept_lines: Draft accepted (lines: 4)
- compare: Compared A vs B — idiomatic shift noted
- decision: Adopt internal rhyme for couplet 3
```

### Journey-aware generation (A→B→C chaining)

- Preview creates Version A; Instruct derives B/C/D by citing the previous version when available.

Parent resolution (thread-scoped latest or cited):

```44:62:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
const rawMode = (parsed.data.mode as string) || "balanced";
const effectiveMode = /* ... */
let parentVersionId: string | null = null;
if (citeVersionId) {
  parentVersionId = citeVersionId;
} else {
  const { data: latestForThread } = await supabase
    .from("versions")
    .select("id, lines, meta, created_at")
    .eq("project_id", projectId)
    .filter("meta->>thread_id", "eq", threadId)
    .order("created_at", { ascending: false })
    .limit(1);
  parentVersionId = latestForThread?.[0]?.id ?? null;
}
```

Bundle inputs include `journeySummaries` (last ~5):

```43:72:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/translator/bundle.ts
const summary = state.summary ?? "";
const ledger = (state.decisions_ledger ?? []).slice(-5);
// ...
// Fetch recent journey items scoped to this thread
const { data: jrows } = await supabase
  .from("journey_items")
  .select("id, kind, summary, created_at, meta")
  .filter("meta->>thread_id", "eq", threadId)
  .order("created_at", { ascending: false })
  .limit(5);
const journeySummaries = (jrows || []).map(/* ... */);
```

Both routes include a JOURNEY block in the prompt:

```206:224:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const userPrompt = [ /* ... */, bundle.journeySummaries?.length
  ? "JOURNEY (most recent → older):\n" +
    bundle.journeySummaries.map((s) => `- ${s}`).join("\n")
  : "", ].filter(Boolean).join("\n\n")
```

```148:161:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
const bundleUser = [ /* ... */, bundle.journeySummaries?.length
  ? "JOURNEY (most recent → older):\n" +
    bundle.journeySummaries.map((s) => `- ${s}`).join("\n")
  : "", ].filter(Boolean).join("\n\n")
```

Example JOURNEY block (format only):

```
JOURNEY (most recent → older):
- accept_lines: Draft accepted (lines: 4)
- compare: Compared A vs B — idiomatic shift noted
- decision: Adopt internal rhyme for couplet 3
```

### LLM Integration Playbook

#### 1) Checklist (copy‑pastable)

1. Gate route with feature flag (if applicable) and auth
   - Use `requireUser` (cookie → Bearer fallback) for write routes
2. Apply rate limit to hot endpoints
   - e.g., `rateLimit(`preview:${threadId}`, 30, 60_000)`
3. Build a deterministic cache key
   - `const key = `${prefix}:${stableHash(payload)}`;`
4. Call Responses API via helper and validate output with Zod
5. Compute and log `prompt_hash` with redacted previews (dev‑only)
6. Return typed JSON with explicit error codes (400/401/403/404/409/429/500/502)

Anchors:

```55:59:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
if (!rl.ok)
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

```157:161:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const key = "translator_preview:" + stableHash({ ...bundle, placeholderId });
const cached = await cacheGet<unknown>(key);
```

```208:216:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const prompt_hash = buildPromptHash({ route: "translator", model: TRANSLATOR_MODEL, system: getTranslatorSystem(effectiveMode), user: userPrompt });
logLLMRequestPreview({ route: "translator", model: TRANSLATOR_MODEL, system: getTranslatorSystem(effectiveMode), user: userPrompt, hash: prompt_hash });
```

#### 2) Templates

- Minimal server handler (protected, cached, rate‑limited)

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiGuard";
import { rateLimit } from "@/lib/ai/ratelimit";
import { stableHash, cacheGet, cacheSet } from "@/lib/ai/cache";
import { responsesCall } from "@/lib/ai/openai";

const Body = z.object({ threadId: z.string().uuid() });
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  const { threadId } = parsed.data;

  const rl = rateLimit(`example:${threadId}`, 30, 60_000);
  if (!rl.ok)
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const payload = { threadId };
  const key = "example:" + stableHash(payload);
  const hit = await cacheGet<unknown>(key);
  if (hit) return NextResponse.json({ ok: true, data: hit, cached: true });

  const r = await responsesCall({
    model: "gpt-5",
    system: "SYSTEM",
    user: "USER",
    temperature: 0.2,
  });
  // parse/validate r → data
  await cacheSet(key, /* data */ r, 3600);
  return NextResponse.json({ ok: true, data: r });
}
```

- Prompt‑hash integration (redacted debug preview)

```12:20:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/promptHash.ts
export function buildPromptHash(args: {
  route: string; model: string; system: string; user: string; schema?: string;
}) {
  const { route, model, system, user, schema } = args;
  return stableHash({ route, model, system, user, schema });
}
```

```30:43:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/promptHash.ts
const DEBUG = process.env.DEBUG_PROMPTS === "1" || process.env.NEXT_PUBLIC_DEBUG_PROMPTS === "1";
if (!DEBUG) return;
// Avoid printing full poem/user content in logs
console.info("[LLM]", { route: args.route, model: args.model, hash: args.hash, systemPreview: squeeze(args.system), userPreview: squeeze(args.user, 300) });
```

- Redacted debug preview pattern in a route

```236:249:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
logLLMRequestPreview({
  route: "translator",
  model: TRANSLATOR_MODEL,
  system: getTranslatorSystem(effectiveMode),
  user: userPrompt,
  hash: prompt_hash,
});
```

#### 3) Do / Don’t

| Do                                                               | Don’t                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Validate all inputs/outputs with Zod before persisting/returning | Return raw model text without validation                   |
| Rate limit hot endpoints and cache idempotent results            | Log full prompts/poems; always redact and gate logs by env |
| Compute `prompt_hash` and log redacted previews in dev           | Include secrets or PII in prompts/keys                     |
| Use feature flags to gate optional surfaces                      | Bypass SSR cookies; always use `requireUser` for writes    |

Anchors:

```3:13:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/ratelimit.ts
export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
```

```13:21:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/cache.ts
export async function cacheGet<T>(key: string): Promise<T | null> {
  const item = mem.get(key);
  if (!item) return null;
```

#### 4) LLM Surface Registration (JSON schema)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "LLMSurfaceRegistration",
  "type": "object",
  "required": [
    "route",
    "model",
    "flags",
    "cache_key_template",
    "rate_limit_bucket"
  ],
  "properties": {
    "route": { "type": "string", "pattern": "^/api/" },
    "model": { "type": "string" },
    "flags": { "type": "array", "items": { "type": "string" } },
    "cache_key_template": {
      "type": "string",
      "description": "e.g., prefix:${stableHash(payload)}"
    },
    "rate_limit_bucket": {
      "type": "string",
      "description": "e.g., preview:${threadId}"
    }
  }
}
```

Example (wiring from Preview):

```55:59:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
```

```153:161:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const key = "translator_preview:" + stableHash({ ...bundle, placeholderId });
```

See also: `docs/llm-api.md`, `docs/flags-and-models.md`.
