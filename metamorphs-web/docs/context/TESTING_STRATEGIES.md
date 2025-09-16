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

### Integration Testing

- Route handlers with mocked Supabase and OpenAI.
- Validate status codes: 400/401/403/404/409/429/502.
  - Include translator anti-echo (409 PREVIEW_ECHOED_SOURCE) path.

Assertion anchors:

```20:24:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

```43:45:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
if (!me?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

```39:43:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
return NextResponse.json(
  { error: "Not ready to translate" },
  { status: 409 }
);
```

```55:58:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const rl = rateLimit(`preview:${threadId}`, 30, 60_000);
if (!rl.ok)
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

```31:35:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
if (!forceTranslate && looksLikeEcho(sourceLines, outLines)) {
  return NextResponse.json({ ok: false, code: "PREVIEW_ECHOED_SOURCE" }, { status: 409 });
}
```

```76:83:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const pre = await moderateText([poem, JSON.stringify(enhanced)].join("\n\n"));
if (pre.flagged) {
  return NextResponse.json(
    { error: "Content flagged by moderation; cannot translate." },
    { status: 400 }
  );
}
```

```25:31:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/verify/route.ts
if (!rl.allowed)
  return NextResponse.json(
    { error: "Daily verification limit reached" },
    { status: 429 }
  );
```

### End-to-End (optional)

- Happy paths: sign-in → start flow → answer → confirm → preview → accept-lines.

Anchors to validate payloads along the path:

```120:131:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const placeholderMeta = {
  thread_id: threadId,
  display_label: displayLabel,
  status: "placeholder" as const,
  parent_version_id: null as string | null,
};
```

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
