Purpose: Token/cost patterns, caching keys/TTL, and rate/quotas with headers.
Updated: 2025-09-16

### [Last Updated: 2025-09-13]

# Spend & Cache Policy (2025-09-16)

## Cost Shape (by surface)

- Translator: single `responses.create` call at `temperature ≈ 0.6`.

```98:104:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const reqPayload = {
  model: TRANSLATOR_MODEL,
  temperature: 0.6,
  messages: [
```

- Prismatic mode (when enabled) remains a single call; sections A/B/C parsed server-side.

```216:219:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const sections =
  isPrismaticEnabled() && effectiveMode === "prismatic"
    ? parsePrismatic(raw)
    : undefined;
```

- Enhancer (planner): single call with JSON output; may retry once with stricter system prompt.

```38:45:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/enhance.ts
const base = {
  model: ENHANCER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" } as const,
};
```

```58:66:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/enhance.ts
const r2 = await openai.responses.create({
  ...base,
  temperature: 0.1,
  messages: [
    { role: "system", content: ENHANCER_SYSTEM + "\nReturn STRICT valid JSON. If unsure, set warnings." },
```

- Verifier / Back-translate: user-initiated JSON calls (`temperature ≈ 0.2` / `0.3`).

```41:47:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/verify.ts
const r = await openai.responses.create({
  model: VERIFIER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
```

```83:90:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/verify.ts
const r = await openai.responses.create({
  model: BACKTRANSLATE_MODEL,
  temperature: 0.3,
  response_format: { type: "json_object" },
```

## Prompt Hash & Caching

- Prompt hash inputs: `{ route, model, system, user, schema? }`.

```11:20:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/promptHash.ts
export function buildPromptHash(args: {
  route: string;
  model: string;
  system: string;
  user: string;
  schema?: string;
}) {
  const { route, model, system, user, schema } = args;
  return stableHash({ route, model, system, user, schema });
}
```

- Cache keys: stable hash of inputs; process memory Map with TTL seconds.

```5:11:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/cache.ts
export function stableHash(obj: unknown): string {
  const json = JSON.stringify(
    obj,
    Object.keys(obj as Record<string, unknown>).sort()
  );
  return crypto.createHash("sha256").update(json).digest("hex");
}
```

```23:29:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/cache.ts
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSec = 3600
): Promise<void> {
  mem.set(key, { expires: Date.now() + ttlSec * 1000, value });
}
```

- Example usage (preview):

```101:109:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const key = "translator_preview:" + stableHash({ ...bundle, placeholderId });
const cached = await cacheGet<unknown>(key);
if (cached) {
  // ...update node meta and return cached preview
}
```

- Example usage (translate):

```74:79:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const key = "translate:" + stableHash(bundle);
const cached = await cacheGet<unknown>(key);
if (cached)
  return NextResponse.json({ ok: true, result: cached, cached: true });
```

## Rate Limiting & Quotas

- Minute bucket (preview): in-memory token bucket keyed by thread; returns 429 JSON when exceeded.

```3:12:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/ratelimit.ts
export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  // ... in-memory bucket
  if (b.count >= limit) return { ok: false, remaining: 0 } as const;
}
```

```49:52:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
if (!rl.ok)
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

- Daily quotas (verify/backtranslate): Upstash Redis sliding window with 429 JSON on exceed.

```1:7:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ratelimit/redis.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
```

```18:21:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/verify/route.ts
const rl = await checkDailyLimit(user.id, "verify", VERIFY_DAILY_LIMIT);
if (!rl.allowed)
  return NextResponse.json(
    { error: "Daily verification limit reached" },
    { status: 429 }
  );
```

## Retry-After headers

- Policy intent: include `Retry-After` for local minute bucket (60s) and daily quotas (86400s). Current routes return 429 JSON without explicit headers; upstream LLM 429s preserve headers.

```3:10:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/http/errors.ts
/** Convert LLM client errors to concise HTTP responses, preserving Retry-After on 429. */
const res = NextResponse.json(body, { status });
if (retryAfter) res.headers.set("Retry-After", String(retryAfter));
```

## Cache Table

| Cache Key Prefix      | Inputs (hashed)                                                     | TTL (sec) | Eviction         | Anchor                                                             |
| --------------------- | ------------------------------------------------------------------- | --------- | ---------------- | ------------------------------------------------------------------ |
| `translator_preview:` | bundle (poem, enhanced, glossary, summary, accepted, placeholderId) | 3600      | TTL expiry (mem) | `metamorphs-web/src/app/api/translator/preview/route.ts:L153–L156` |
| `translate:`          | poem, enhanced, summary, ledger, accepted, glossary                 | 3600      | TTL expiry (mem) | `metamorphs-web/src/app/api/translate/route.ts:L89–L93`            |
| `enhancer:`           | poem, fields                                                        | 3600      | TTL expiry (mem) | `metamorphs-web/src/app/api/enhancer/route.ts:L52–L56`             |

Implementation

```13:21:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/cache.ts
export async function cacheGet<T>(key: string): Promise<T | null> {
  const item = mem.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    mem.delete(key);
    return null;
  }
  return item.value as T;
}
```

```23:29:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/cache.ts
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSec = 3600
): Promise<void> {
  mem.set(key, { expires: Date.now() + ttlSec * 1000, value });
}
```

## Rate-limit Rules

- Preview minute bucket: 30 requests per 60 seconds per `threadId`.

```55:58:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
if (!rl.ok)
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

- Token bucket helper (in-memory):

```3:12:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/ratelimit.ts
export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.until) {
    buckets.set(key, { count: 1, until: now + windowMs });
    return { ok: true, remaining: limit - 1 } as const;
  }
  if (b.count >= limit) return { ok: false, remaining: 0 } as const;
  b.count += 1;
  return { ok: true, remaining: limit - b.count } as const;
}
```

- Daily quotas (verify/backtranslate): service-backed (Upstash) helper.

```1:7:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ratelimit/redis.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
```
