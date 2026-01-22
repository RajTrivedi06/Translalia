doc_purpose: "Specify cost controls, cache keys/TTLs, rate/quotas, and invalidation"
audiences: ["devs","ops","prompt-engineers","LLM"]
version: "2025-11-04"
last_scanned_code_at: "2025-11-04"
evidence_policy: "anchors-required"

### Summary

Defines how we minimize spend with caching, rate limiting, and disciplined API patterns. Lists cache key prefixes, hashed inputs, default TTLs, and quota rules with code anchors.

### LLM Consumption

- **cache.key**: `<prefix>` + `stableHash(bundle)` or deterministic tuple
- **cache.ttl_seconds**: 3600 (default)
- **rate.minute_bucket**: helper available (in‑memory); not currently used in active routes
- **rate.daily_quota**: Redis helper stubbed (always allows) in this snapshot
- **hash.schema** (prompt hash object used in logs/ids):

```json
{
  "route": "string",
  "model": "string",
  "system": "string",
  "user": "string",
  "schema": "string?"
}
```

- **cache.key.schema** (conceptual structure):

```json
{
  "key": "string",
  "prefix": "ai-assist|workshop|prismatic",
  "hash": "sha256-hex"
}
```

### Canonical Maps

#### MODELS_MAP (cost‑relevant defaults)

| Surface        | Default model           | Anchor                                                                          |
| -------------- | ----------------------- | ------------------------------------------------------------------------------- |
| Translator     | "gpt-4o"                | /Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts#L2-L2      |
| Enhancer       | "gpt-5-mini"            | /Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts#L4-L5      |
| Router         | "gpt-5-nano-2025-08-07" | /Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts#L7-L8      |

#### FLAGS_MAP (cost gating)

In this snapshot, cost‑gating feature flags are defined as helpers but not wired into routes. The UI‑only `SIDEBAR_LAYOUT` flag exists and does not affect cost.

### LLM API Patterns (responses.create, hashing, previews)

- Helper handles non‑generative models and retry on unsupported temperature.

```38:51:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
const args: Record<string, unknown> = { model };
const nonGen = isNonGenerative(model);
if (!nonGen && typeof temperature === "number")
  args.temperature = temperature;
if (!nonGen && typeof top_p === "number") args.top_p = top_p;
if (typeof user === "string") {
  args.instructions = system;
  args.input = user;
} else {
  args.input = [{ role: "system", content: system }, ...user];
}
```

```68:83:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
const unsupportedTemp = /Unsupported parameter:\s*'temperature'/i.test(msg);
if (unsupportedTemp) {
  const retryArgs: Record<string, unknown> = { ...args };
  delete (retryArgs as Record<string, unknown> & { temperature?: unknown })
    .temperature;
  delete (retryArgs as Record<string, unknown> & { top_p?: unknown }).top_p;
  delete (
    retryArgs as Record<string, unknown> & { response_format?: unknown }
  ).response_format;
  // retry without optional params
}
```

### Cost & Caching Policy

- Cache implementation: in‑process Map with per‑entry expiry.

```13:21:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/cache.ts
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

- Key construction and TTL usage in routes:

```101:108:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
const wordsKey = selectedWords.map((w) => w.text).join("_");
const cacheKey = `ai-assist:${threadId}:${cellId}:${wordsKey}:${instruction || "refine"}`;
const cached = await cacheGet<AIAssistResponse>(cacheKey);
if (cached) {
  return NextResponse.json(cached);
}
```

```73:79:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/workshop/generate-options/route.ts
const cacheKey = `workshop:${threadId}:line:${lineIndex}`;
const cached = await cacheGet<GenerateOptionsResponse>(cacheKey);
if (cached) {
  return NextResponse.json(cached);
}
```

### Rate limiting and quotas

```3:12:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/ratelimit.ts
export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  // in-memory sliding window
}
```

```8:15:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ratelimit/redis.ts
export async function checkDailyLimit(
  userId: string,
  key: string,
  max: number
) {
  // Always allow for now
  return { allowed: true, current: 0, max } as const;
}
```

- Recommendation: include `Retry-After` headers for 429s when limiters are enabled.

```3:10:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/http/errors.ts
/** Convert LLM client errors to concise HTTP responses, preserving Retry-After on 429. */
const res = NextResponse.json(body, { status });
if (retryAfter) res.headers.set("Retry-After", String(retryAfter));
```

## Cache Table

| Cache Key Prefix | Inputs (hashed)                                  | TTL (sec) | Eviction         | Anchor                                                             |
| ---------------- | -------------------------------------------------- | --------- | ---------------- | ------------------------------------------------------------------ |
| `ai-assist:`     | selectedWords, instruction, threadId, cellId      | 3600      | TTL expiry (mem) | `src/app/api/notebook/ai-assist/route.ts#L101-L107`                |
| `workshop:`      | lineIndex, threadId                                | 3600      | TTL expiry (mem) | `src/app/api/workshop/generate-options/route.ts#L73-L79`           |
| `prismatic:`     | threadId, lineIndex (commented optional cache)     | —         | —                | `src/app/api/notebook/prismatic/route.ts#L70-L75`                  |

Implementation

```13:21:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/cache.ts
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

```23:29:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/cache.ts
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSec = 3600
): Promise<void> {
  mem.set(key, { expires: Date.now() + ttlSec * 1000, value });
}
```

## Rate-limit Rules

- Example policy: 30 requests per 60 seconds per `threadId` (use `rateLimit(key, 30, 60_000)`).
- Daily quota policy: e.g., 600 requests/day for some endpoints via `checkDailyLimit(userId, key, 600)` once enabled.

## Token/cost optimization

- Prefer JSON outputs with `response_format` to avoid repair retries.
- Cache idempotent results (same inputs) for 1 hour using stable hashed keys.
- Avoid logging full prompts; if needed, gate with env and redact.
- Prefer smaller models (`gpt-5-mini`, `gpt-5-nano-*`) where quality permits; fallback to `gpt-4o-mini` only on model errors.

## Monitoring & alerting

- Add provider billing alerts and daily usage dashboards; log per‑route counts and cache hit rates. (Not implemented in this snapshot.)
