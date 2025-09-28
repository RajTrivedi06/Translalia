### [Last Updated: 2025-09-16]

## Testing Strategies

### LLM Quick Reference

- Test pure logic (questions/parse) with unit tests.
- Contract-test APIs: validate 4xx/5xx codes and shapes.
- Mock Supabase and OpenAI clients.

### Context Boundaries

- Covers testing approaches; does not duplicate API specs.

### Unit Testing

- Targets: `server/flow/questions.ts`, `server/translator/parse.ts`, helpers in `lib/*`.
- Patterns: arrange/act/assert; test invalid inputs and edge cases.

Examples (parser):

```10:18:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/translator/parse.ts
export function parseTranslatorOutput(raw: string): TranslatorParsed {
  const text = raw ?? "";
  const afterA = text.split(/---VERSION A---/i)[1] ?? "";
  const [poemRaw, notesRaw] = afterA.split(/---NOTES---/i);
```

Assert that missing markers throws Zod error when notes are empty; valid markers yield `{ lines[], notes[] }`.

### Testing Matrix

| Module                       | Test Level(s) | Core Assertions                                                  | Anchors                                                                                    |
| ---------------------------- | ------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `server/translator/parse.ts` | Unit          | Parses markers; trims lines; caps notes at 10; throws on invalid | ```10:17:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/translator/parse.ts |

const afterA = text.split(/---VERSION A---/i)[1] ?? "";
const [poemRaw, notesRaw] = afterA.split(/---NOTES---/i);

````|
| `server/flow/questions.ts` | Unit | `computeNextQuestion` routing; `processAnswer` normalization; list parsing | ```96:105:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/flow/questions.ts
export function computeNextQuestion(state: SessionState): Question | null {
  const f = state.collected_fields ?? {};
  if (!f.target_lang_or_variety) return QUESTIONS[0];
  if (!f.style_form?.meter || !f.style_form?.rhyme) return QUESTIONS[1];
``` |
| `app/api/translator/preview` | Integration | 403 when feature off; 401 on missing user; 429 on rate limit; 409 on echo; 500/502 on LLM/DB failures; 200 with cached flag | ```34:36:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
````

```55:58:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

````157:165:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const key = "translator_preview:" + stableHash({ ...bundle, placeholderId });
const cached = await cacheGet<unknown>(key);
``` |
| `app/api/enhancer` | Integration | 403 feature off; 404 no thread; 409 no poem; 400 moderation; 200 cached | ```52:56:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/enhancer/route.ts
const payload = { poem, fields };
const key = "enhancer:" + stableHash(payload);
const cached = await cacheGet<unknown>(key);
``` |
| `app/api/translate` | Integration | 409 not ready; 400 moderation; 502 invalid parse; 200 cached | ```38:44:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
if (state.phase !== "translating" && state.phase !== "review") {
  return NextResponse.json(
    { error: "Not ready to translate" },
    { status: 409 }
  );
}
``` |
| `lib/ai/cache.ts` | Unit | Stable key hashing sorted keys; TTL expiry deletes | ```5:11:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/cache.ts
export function stableHash(obj: unknown): string {
  const json = JSON.stringify(
    obj,
    Object.keys(obj as Record<string, unknown>).sort()
  );
  return crypto.createHash("sha256").update(json).digest("hex");
}
``` |
| `lib/ai/ratelimit.ts` | Unit | Window reset; count increments; deny at limit | ```1:8:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/ratelimit.ts
const buckets = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b or now > b.until) { /* resets */ }
}
``` |
| `lib/ratelimit/redis.ts` | Integration (with test Redis) | Increments; sets TTL on first; respects max | ```33:39:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ratelimit/redis.ts
const res = await l.redis.incr(id);
if (res === 1) {
  const ttl = 24 * 60 * 60;
  await l.redis.expire(id, ttl);
}
``` |

### End-to-End

- Happy paths: sign-in → start flow → answer → confirm → preview → accept-lines.

Anchors to validate payloads along the path:

```120:131:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const placeholderMeta = {
  thread_id: threadId,
  display_label: displayLabel,
  status: "placeholder" as const,
  parent_version_id: null as string | null,
};
````

### Fixtures & Mocks

- Create minimal thread/project fixtures in a test schema or via Supabase test project.
- Mock OpenAI chat completions to return deterministic outputs.

### Performance Tests

- Measure translator preview latency and cache hit rates.

Anchors:

```153:156:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const key = "translator_preview:" + stableHash({ ...bundle, placeholderId });
const cached = await cacheGet<unknown>(key);
```

### Related Files

- docs/flow-api.md
- docs/llm-api.md

### Route Tests (Translator)

- Instruct returns 409 on echo/untranslated after retry; 502 on empty or parse failure; 409 on missing must_keep after retry; 422 on missing target variety.

```270:279:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
if (echoish1 || untranslated1 || hangulUntranslated1) {
  const hardReq = `\n\nHARD REQUIREMENT: Output must be fully in the target language; do NOT echo or quote SOURCE_POEM lines or reproduce non-target script.`;
  const retryUser = bundleUser + hardReq;
  const respRetryUnknown: unknown = await responsesCall({ /* ... */ });
}
```

```332:346:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
return NextResponse.json(
  { ok: false, code: "INSTRUCT_ECHO_OR_UNTRANSLATED", retryable: true },
  { status: 409 }
);
```

```283:297:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
return NextResponse.json(
  { ok: false, code: "INSTRUCT_RETRY_EMPTY", retryable: true },
  { status: 502 }
);
```

```304:317:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
return NextResponse.json(
  { ok: false, code: "INSTRUCT_PARSE_RETRY_FAILED", retryable: true },
  { status: 502 }
);
```

```389:409:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
return NextResponse.json(
  {
    ok: false,
    code: "REQUIRED_TOKENS_MISSING",
    retryable: true,
    missing: missing2,
  },
  { status: 409 }
);
```

```108:116:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
if (state.phase !== "translating" && state.phase !== "review") {
  return NextResponse.json(
    { error: "Not ready to translate" },
    { status: 409 }
  );
}
```

### Flow Tests (Chaining)

- When creating B, set `parent_version_id = A`; similarly C→B, D→C; verify via `GET /api/versions/nodes?threadId=...` ordered ascending.

```33:38:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/nodes/route.ts
.from("versions")
.select("id, tags, meta, created_at")
.eq("project_id", th.project_id)
.filter("meta->>thread_id", "eq", threadId)
```

### UI Tests (VersionCanvas)

- Canvas renders directed edges count = (versions − 1) with arrow markers and stroke width.

```151:161:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/versions/VersionCanvas.tsx
const lineage: Edge[] = (apiNodes || [])
  .filter((n) => !!n.parent_version_id)
  .map((n) => ({
    id: `lineage:${String(n.parent_version_id)}->${n.id}`,
    source: String(n.parent_version_id),
    target: n.id,
    type: "straight",
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
```

```327:331:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/versions/VersionCanvas.tsx
defaultEdgeOptions={{ animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 3 } }}
```
