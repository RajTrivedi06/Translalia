Purpose: Error taxonomy, status usage, Retry-After policy vs implementation.
Updated: 2025-09-16

### [Last Updated: 2025-09-16]

# Error Handling (2025-09-16)

## Status codes (observed in code)

- `401` unauthenticated

```43:45:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
if (!me?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

- `403` forbidden/feature-off (policy); used for translator/enhancer feature gates and access guards

```28:30:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

```50:52:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/flow/peek/route.ts
return NextResponse.json(
  { ok: false, code: "FORBIDDEN_THREAD" },
  { status: 403 }
);
```

- `404` not found or feature-off (implementation choice for verify/backtranslate/interview)

```10:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/verify/route.ts
if (!isVerifyEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

- `409` invalid phase or conflicting state

```41:43:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translate/route.ts
return NextResponse.json(
  { error: "Not ready to translate" },
  { status: 409 }
);
```

- `429` rate limit exceeded (minute or daily)

```49:52:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
if (!rl.ok)
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

```18:23:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/verify/route.ts
const rl = await checkDailyLimit(user.id, "verify", VERIFY_DAILY_LIMIT);
if (!rl.allowed)
  return NextResponse.json(
    { error: "Daily verification limit reached" },
    { status: 429 }
  );
```

- `500` unexpected server error

```95:97:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
return NextResponse.json(
  {
    error: insErr?.message || "Failed to create placeholder",
  },
  { status: 500 }
);
```

- `502` LLM contract invalid / upstream issues

```205:207:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
return NextResponse.json(
  { error: "LLM returned empty output" },
  { status: 502 }
);
```

## Retry-After (policy vs implementation)

- Policy intent:
  - Local minute bucket (preview) should include `Retry-After: 60`.
  - Daily quotas (verify/backtranslate) should include `Retry-After: 86400`.
- Implementation: current route handlers return 429 JSON bodies without explicit headers; add headers in future.

```3:10:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/http/errors.ts
/** Convert LLM client errors to concise HTTP responses, preserving Retry-After on 429. */
export function respondLLMError(e: any) {
  const status = e?.status ?? e?.response?.status ?? 502;
  const retryAfter = e?.response?.headers?.get?.("retry-after");
  const res = NextResponse.json({ error: e?.message ?? "LLM error" }, { status });
  if (retryAfter) res.headers.set("Retry-After", String(retryAfter));
  return res;
}
```

## Error Taxonomy

| code                             | http_status | retry_after     | is_transient | suggested remediation                        | Anchors                                                                                               |
| -------------------------------- | ----------- | --------------- | ------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| MISSING_THREAD_ID                | 400         | none            | false        | Provide `threadId` query param               | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/flow/peek/route.ts#L10-L16             |
| MISSING_PROJECT_ID               | 400         | none            | false        | Provide `projectId` query param              | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/threads/list/route.ts#L10-L15          |
| THREAD_NOT_FOUND                 | 404         | none            | false        | Ensure thread exists and is owned            | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/flow/peek/route.ts#L29-L33             |
| PROJECT_NOT_FOUND                | 404         | none            | false        | Ensure project exists                        | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/threads/list/route.ts#L42-L46          |
| FORBIDDEN_THREAD                 | 403         | none            | false        | Use an owned thread                          | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/flow/peek/route.ts#L48-L52             |
| FORBIDDEN_PROJECT                | 403         | none            | false        | Use an owned project                         | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/threads/list/route.ts#L31-L35          |
| PREVIEW_ECHOED_SOURCE            | 409         | none            | true         | Retry with `forceTranslate` or adjust prompt | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts#L355-L361  |
| REQUIRED_TOKENS_MISSING          | 409         | none            | true         | Remove or adjust must_keep; try again        | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts#L399-L409 |
| INSTRUCT_ECHO_OR_UNTRANSLATED    | 409         | none            | true         | Strengthen instruction; re-run               | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts#L333-L346 |
| INSTRUCT_RETRY_EMPTY             | 502         | none            | true         | Retry operation later                        | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts#L283-L297 |
| INSTRUCT_PARSE_RETRY_FAILED      | 502         | none            | true         | Improve schema; re-run                       | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts#L304-L317 |
| Rate limit exceeded              | 429         | 60s (policy)    | true         | Wait and retry                               | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts#L55-L58    |
| Daily verification limit reached | 429         | 86400s (policy) | true         | Retry next day                               | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/verify/route.ts#L18-L23     |

### Error Envelope (JSON Schema)

```json
{
  "type": "object",
  "properties": {
    "ok": { "type": "boolean" },
    "error": { "type": "string" },
    "code": { "type": "string" },
    "retryable": { "type": "boolean" },
    "prompt_hash": { "type": "string" }
  },
  "additionalProperties": true
}
```

## Observability

- `prompt_hash` is attached to JSON responses where LLM calls are proxied.

```70:87:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/enhancer/route.ts
if (!r.ok) {
  return NextResponse.json(
    { error: r.error, prompt_hash: r.prompt_hash },
    { status: 502 }
  );
}
...
return NextResponse.json({ ok: true, plan, prompt_hash: r.prompt_hash });
```

- Redacted previews are logged only when `DEBUG_PROMPTS` or `NEXT_PUBLIC_DEBUG_PROMPTS` is `1`.

```30:33:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/promptHash.ts
const DEBUG =
  process.env.DEBUG_PROMPTS === "1" ||
  process.env.NEXT_PUBLIC_DEBUG_PROMPTS === "1";
```

## UI Error Hygiene (V2)

### Sidebar cards: Skeleton / Empty / Error

- Use lightweight skeletons while loading.

```85:91:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
{loading && (
  <div aria-busy="true" aria-live="polite" className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
    ))}
  </div>
)}
```

- Show concise error state without crashing the pane.

```93:95:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
{!loading && error && (
  <p className="text-sm text-red-600 dark:text-red-400">{t("couldNotLoadSource")}</p>
)}
```

- Provide empty state with neutral copy.

```97:101:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
{!loading && !error && !hasSource && (
  <p className="text-sm text-neutral-500">
    {t("noSource")}
  </p>
)}
```

- Apply the same skeleton pattern to analysis.

```32:37:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/sidebar/AnalysisCard.tsx
{loading && (
  <div aria-busy="true" className="space-y-2">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
    ))}
  </div>
)}
```

### Non-throwing UI guidelines

- Chat send: toast on failure; keep composer usable.

```393:396:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/chat/ChatPanel.tsx
if (!res.ok) {
  const json = await res.json().catch(() => ({}));
  toastError(json?.error || "Failed to send");
  return;
}
```

- Offline send guard surfaces a user-friendly toast.

```70:75:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/chat/ChatPanel.tsx
try {
  assertOnline();
} catch (e) {
  const msg = e instanceof Error ? e.message : "You’re offline — try again later.";
  toastError(msg);
  return;
}
```

- Silent fallbacks for auxiliary flows (intent, peek, nodes): swallow non-critical errors and proceed.

```493:495:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/chat/ChatPanel.tsx
} catch {
  // ignore and proceed; errors surface via toasts elsewhere
}
```

### A11y surfacing

- Timeline uses `role="log"` with `aria-live="polite"` for incremental updates.

```11:14:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/v2/chat/ChatView.tsx
<div
  role="log"
  aria-live="polite"
  className="flex-1 overflow-y-auto bg-gray-50 p-6 md:p-8"
>
```

- Toasts should be announced politely; prefer `aria-live="polite"` region in the toast system if available (non-blocking to screen readers).

### Patterns (non-throwing UI)

- Chat send toasts on failure; form remains usable:

```393:396:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/chat/ChatPanel.tsx
if (!res.ok) {
  const json = await res.json().catch(() => ({}));
  toastError(json?.error || "Failed to send");
  return;
}
```

- Offline upload guard → toast, no crash:

```69:75:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/chat/ChatPanel.tsx
try {
  assertOnline();
} catch (e) {
  const msg = e instanceof Error ? e.message : "You’re offline — try again later.";
  toastError(msg);
  return;
}
```

- Retryable preview trigger is wrapped with try/catch in UI:

```201:211:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/chat/ChatPanel.tsx
try {
  const pv = await translatorPreview.mutateAsync(undefined);
  setTranslatorData({ lines: pv.preview.lines, notes: pv.preview.notes });
  setTranslatorError(null);
} catch {
  setTranslatorError("Preview failed. Please retry.");
}
```

- Plan Builder side-effects are isolated with try/catch and error logs:

```111:136:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/flow/PlanBuilderOverviewSheet.tsx
try {
  const peekRes = await fetch(`/api/flow/peek?threadId=${threadId}`);
  // … confirm phase
} catch (err) {
  console.error("Failed to check/confirm phase:", err);
}
```

### Guards (navigation/redirection)

- WorkspaceShell peeks thread; on 401/403/404, shows code and can redirect user to select/start a chat:

```47:59:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/components/workspace/WorkspaceShell.tsx
try {
  const res = await fetch(`/api/flow/peek?threadId=${effectiveThreadId}`);
  if (res.status === 404 || res.status === 403 || res.status === 401) {
    let code = String(res.status);
    try { const json = await res.json(); code = json?.code || code; } catch {}
    // UI can route user to chats list/select existing thread
  }
} catch {}
```

### A11y

- Use `aria-live="polite"` where possible for transient status/toast regions (TODO if toast system lacks landmark).
