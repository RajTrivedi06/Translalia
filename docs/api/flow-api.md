Purpose: Contracts and behaviors for flow-related API endpoints, with flags and errors.
Updated: 2025-09-16

### [Last Updated: 2025-09-16]

# Flow API (2025-09-16)

All endpoints are thread-scoped (`projectId`, `threadId`) and auth-guarded unless stated.

## Contracts Index

| Route                         | Method | Request schema                                                                                          | Response schema                                                                | Error codes                       | Flags                               | Anchors                                                                                                                                                                                                            |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| /api/flow/answer              | POST   | `{ threadId: uuid, questionId: enum, answer: string }`                                                  | `{ ok: true, phase, nextQuestion?, snapshot? }`                                | 400, 404                          | —                                   | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/flow/answer/route.ts#L13-L26; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/flow/answer/route.ts#L86-L108                          |
| /api/flow/start               | POST   | `{ threadId: uuid, poem: string }`                                                                      | `{ ok: true, phase: "interviewing", nextQuestion }`                            | 400, 404                          | —                                   | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/flow/start/route.ts#L8-L12; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/flow/start/route.ts#L55-L59                              |
| /api/flow/confirm             | POST   | `{ threadId: uuid }`                                                                                    | `{ ok: true, phase: "translating" }`                                           | 400, 404, 409                     | —                                   | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/flow/confirm/route.ts#L7-L15; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/flow/confirm/route.ts#L28-L31                          |
| /api/flow/intent              | POST   | `{ message: string, phase: string }`                                                                    | `{ intent: string                                                              | null }`                           | 400                                 | `NEXT_PUBLIC_FEATURE_ROUTER` (indirect)                                                                                                                                                                            | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/flow/intent/route.ts#L5-L12; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/server/flow/intentLLM.ts#L11-L18 |
| /api/translator/preview       | POST   | `{ threadId: uuid, forceTranslate?: boolean, mode?: enum }`                                             | `{ ok: true, preview, mode, sections?, versionId, displayLabel, prompt_hash }` | 400, 401, 403, 409, 429, 500, 502 | `NEXT_PUBLIC_FEATURE_TRANSLATOR`    | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts#L33-L41; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts#L268-L276           |
| /api/translator/instruct      | POST   | `{ threadId: uuid, instruction: string, citeVersionId?: uuid, mode?: enum }`                            | `{ ok: true, versionId, displayLabel, prompt_hash, mode, sections? }`          | 400, 401, 403, 409, 500, 502      | `NEXT_PUBLIC_FEATURE_TRANSLATOR`    | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts#L24-L32; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts#L445-L456         |
| /api/translate                | POST   | `{ threadId: uuid }`                                                                                    | `{ ok: true, result, usage? }`                                                 | 400, 403, 404, 409, 422, 502      | `NEXT_PUBLIC_FEATURE_TRANSLATOR`    | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translate/route.ts#L13-L21; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translate/route.ts#L149-L153                             |
| /api/enhancer                 | POST   | `{ threadId: uuid }`                                                                                    | `{ ok: true, plan, prompt_hash }`                                              | 400, 403, 404, 502                | `NEXT_PUBLIC_FEATURE_ENHANCER`      | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/enhancer/route.ts#L11-L16; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/enhancer/route.ts#L86-L86                                 |
| /api/translator/verify        | POST   | `{ projectId: uuid, threadId: uuid, source: string, candidate: string }`                                | `{ data, prompt_hash }`                                                        | 400, 404, 429, 502                | `NEXT_PUBLIC_FEATURE_VERIFY`        | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/verify/route.ts#L7-L16; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/verify/route.ts#L25-L31                |
| /api/translator/backtranslate | POST   | `{ projectId: uuid, threadId: uuid, candidate: string }`                                                | `{ data, prompt_hash }`                                                        | 400, 404, 429, 502                | `NEXT_PUBLIC_FEATURE_BACKTRANSLATE` | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/backtranslate/route.ts#L10-L19; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/backtranslate/route.ts#L32-L39 |
| /api/versions                 | POST   | `{ projectId: uuid, title: string, lines: string[], tags?: string[], meta?: object, summary?: string }` | `{ version }`                                                                  | 400                               | —                                   | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/versions/route.ts#L16-L24; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/versions/route.ts#L51-L51                                 |
| /api/versions/nodes           | GET    | `?threadId=uuid`                                                                                        | `{ ok: true, nodes: [] }`                                                      | 400, 403, 404, 500                | —                                   | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/versions/nodes/route.ts#L8-L15; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/versions/nodes/route.ts#L63-L69                      |
| /api/versions/positions       | PATCH  | `{ projectId, positions: [{id, pos:{x,y}}...] }`                                                        | `{ ok: true }`                                                                 | 400                               | —                                   | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/versions/positions/route.ts#L5-L15; /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/versions/positions/route.ts#L31-L34              |

## Translator (Preview)

`POST /api/translator/preview`

- Flags: `NEXT_PUBLIC_FEATURE_TRANSLATOR` (OFF → 403)

```28:30:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

- Body: `{ threadId: uuid, forceTranslate?: boolean, mode?: 'balanced'|'creative'|'prismatic' }`
- Returns: `{ ok, preview, sections?, mode, versionId, displayLabel, prompt_hash }`
- Errors: `400` invalid, `401` unauthenticated, `403` feature-off, `409` echo guard, `429` rate limit, `500` DB errors, `502` LLM contract

```49:52:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
if (!rl.ok)
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

```220:231:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
if (!forceTranslate && looksLikeEcho(sourceLines, outLines)) {
  return NextResponse.json({ ok: false, code: "PREVIEW_ECHOED_SOURCE", error: "Model echoed source text." }, { status: 409 });
}
```

- Placeholder node behavior: inserts `versions` row with `status: "placeholder"`, updates to `generated` with `overview` upon success; if cache hit, flips status from cached preview.

```124:141:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
const { data: inserted, error: insErr } = await sb
  .from("versions")
  .insert({
    project_id: projectId,
    title: displayLabel,
    lines: [],
    meta: placeholderMeta,
    tags: ["translation"],
  })
  .select("id")
  .single();
```

```161:169:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
const updatedMeta: Record<string, unknown> = {
  ...placeholderMeta,
  status: "generated" as const,
  overview: {
    lines: cachedPrev?.lines ?? [],
    notes: cachedPrev?.notes ?? [],
  },
};
```

## Translator (Instruct)

`POST /api/translator/instruct`

- Flags: `NEXT_PUBLIC_FEATURE_TRANSLATOR` (OFF → 403)
- Auth: uses `requireUser()` (401 on missing)
- Creates placeholder node; updates on success

```22:24:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

```43:45:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
if (!me?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

```252:266:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
const updatedMeta: Record<string, unknown> = {
  ...placeholderMeta,
  status: "generated" as const,
  overview: {
    lines: parsedOut.lines,
    notes: parsedOut.notes,
  },
};
const { error: upErr } = await supabase
  .from("versions")
  .update({ meta: updatedMeta })
  .eq("id", newVersionId);
if (upErr)
  return NextResponse.json({ error: upErr.message }, { status: 500 });
```

## Translate (Full)

`POST /api/translate`

- Flags: `NEXT_PUBLIC_FEATURE_TRANSLATOR` (OFF → 403)
- Requires thread phase readiness; else 409

```16:18:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translate/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

```41:43:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translate/route.ts
return NextResponse.json(
  { error: "Not ready to translate" },
  { status: 409 }
);
```

## Enhancer (Planner)

`POST /api/enhancer`

- Flags: `NEXT_PUBLIC_FEATURE_ENHANCER` (OFF → 403)
- Returns: `{ ok, plan, prompt_hash }` or `{ error, prompt_hash }`

```14:16:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/enhancer/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_ENHANCER !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

```70:76:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/enhancer/route.ts
if (!r.ok) {
  return NextResponse.json(
    { error: r.error, prompt_hash: r.prompt_hash },
    { status: 502 }
  );
}
```

## Verify (Optional)

`POST /api/translator/verify`

- Flags: `NEXT_PUBLIC_FEATURE_VERIFY` (OFF → 404 implementation)
- Daily limit with 429 on exceed

```10:12:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/verify/route.ts
if (!isVerifyEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

```18:23:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/verify/route.ts
const rl = await checkDailyLimit(user.id, "verify", VERIFY_DAILY_LIMIT);
if (!rl.allowed)
  return NextResponse.json(
    { error: "Daily verification limit reached" },
    { status: 429 }
  );
```

## Back-translate (Optional)

`POST /api/translator/backtranslate`

- Flags: `NEXT_PUBLIC_FEATURE_BACKTRANSLATE` (OFF → 404 implementation)
- Daily limit with 429 on exceed

```13:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/backtranslate/route.ts
if (!isBacktranslateEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

```21:29:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/backtranslate/route.ts
const rl = await checkDailyLimit(
  user.id,
  "backtranslate",
  BACKTRANSLATE_DAILY_LIMIT
);
if (!rl.allowed)
  return NextResponse.json(
    { error: "Daily back-translation limit reached" },
    { status: 429 }
  );
```

## Interview Clarifier

Deprecated. Interview itself (Q1) collects the target variety; the clarifier LLM endpoint is unused by the client.

## Stepwise Chaining (A → B → C → D)

- Preview produces Version A; `meta.parent_version_id = null`.

```129:135:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
const placeholderMeta = {
  thread_id: threadId,
  display_label: displayLabel,
  status: "placeholder" as const,
  parent_version_id: null as string | null,
};
```

- Instruct determines `parent_version_id` as:
  - If `citeVersionId` provided, use that.
  - Else use latest version in the same `thread_id` (most recent by `created_at`).

```60:72:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
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

- When a cited or implicit parent exists, Instruct includes a whole‑text block to evolve from the prior version.

```125:142:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
if (cited) {
  const m = ((cited.meta ?? null) as Record<string, unknown>) || {};
  const ov = (m["overview"] as { lines?: string[] } | null) || null;
  const ovLines: string[] = Array.isArray(ov?.lines)
    ? (ov!.lines as string[])
    : [];
  const lnLines: string[] = Array.isArray(cited.lines)
    ? (cited.lines as string[])
    : [];
  const arr = ovLines.length ? ovLines : lnLines;
  citedText = arr.join("\n");
}
```

- Preview and Instruct append JOURNEY context into prompts.

```228:234:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
bundle.journeySummaries?.length
  ? "JOURNEY (most recent → older):\n" +
    bundle.journeySummaries.map((s) => `- ${s}`).join("\n")
  : "",
```

```194:201:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
bundle.journeySummaries?.length
  ? "JOURNEY (most recent → older):\n" +
    bundle.journeySummaries.map((s) => `- ${s}`).join("\n")
  : "",
```

### Fields written on success

- Both routes write:
  - `meta.overview.lines`
  - `meta.overview.notes`
  - `meta.overview.line_policy` (preview)
  - `meta.status = "generated"`

```438:447:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
const updatedMeta: Record<string, unknown> = {
  ...placeholderMeta,
  status: "generated" as const,
  overview: {
    lines: preview.lines,
    notes: preview.notes,
    line_policy: bundle.line_policy,
  },
};
```

```428:436:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
const updatedMeta: Record<string, unknown> = {
  ...placeholderMeta,
  status: "generated" as const,
  overview: {
    lines: parsedOut.lines,
    notes: parsedOut.notes,
    line_policy: (bundle as unknown as { line_policy?: unknown })?.line_policy,
  },
};
```

### Error codes (Instruct)

| Code                          | HTTP | Meaning                                    |
| ----------------------------- | ---- | ------------------------------------------ |
| INSTRUCT_ECHO_OR_UNTRANSLATED | 409  | Echo or wrong language even after retry    |
| INSTRUCT_RETRY_EMPTY          | 502  | Retry returned empty output                |
| INSTRUCT_PARSE_RETRY_FAILED   | 502  | Retry output could not be parsed           |
| REQUIRED_TOKENS_MISSING       | 409  | Tokens still missing after must_keep retry |

```332:346:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
return NextResponse.json(
  { ok: false, code: "INSTRUCT_ECHO_OR_UNTRANSLATED", retryable: true },
  { status: 409 }
);
```

```283:297:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
return NextResponse.json(
  { ok: false, code: "INSTRUCT_RETRY_EMPTY", retryable: true },
  { status: 502 }
);
```

```304:317:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
return NextResponse.json(
  { ok: false, code: "INSTRUCT_PARSE_RETRY_FAILED", retryable: true },
  { status: 502 }
);
```

```399:409:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
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

### Planned (prompt centralization & banned-phrases)

- Centralize system/user prompt assembly as constants/functions, reusing `src/lib/ai/prompts.ts` with mode-aware variants.
- Introduce a banned-phrases check to enforce decolonial guardrails (reject/replace harmful wording before Requests API call).
- No immediate API contract changes; server routes keep current schemas.
