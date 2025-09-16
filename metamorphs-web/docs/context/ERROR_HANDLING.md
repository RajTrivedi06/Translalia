Purpose: Error taxonomy, status usage, Retry-After policy vs implementation.
Updated: 2025-09-16

### [Last Updated: 2025-09-16]

# Error Handling (2025-09-16)

## Status codes (observed in code)

- `401` unauthenticated

```43:45:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
if (!me?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

- `403` forbidden/feature-off (policy); used for translator/enhancer feature gates and access guards

```28:30:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

```50:52:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/flow/peek/route.ts
return NextResponse.json(
  { ok: false, code: "FORBIDDEN_THREAD" },
  { status: 403 }
);
```

- `404` not found or feature-off (implementation choice for verify/backtranslate/interview)

```10:15:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/verify/route.ts
if (!isVerifyEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

- `409` invalid phase or conflicting state

```41:43:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
return NextResponse.json(
  { error: "Not ready to translate" },
  { status: 409 }
);
```

- `429` rate limit exceeded (minute or daily)

```49:52:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
if (!rl.ok)
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

```18:23:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/verify/route.ts
const rl = await checkDailyLimit(user.id, "verify", VERIFY_DAILY_LIMIT);
if (!rl.allowed)
  return NextResponse.json(
    { error: "Daily verification limit reached" },
    { status: 429 }
  );
```

- `500` unexpected server error

```95:97:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
return NextResponse.json(
  {
    error: insErr?.message || "Failed to create placeholder",
  },
  { status: 500 }
);
```

- `502` LLM contract invalid / upstream issues

```205:207:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
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

```3:10:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/http/errors.ts
/** Convert LLM client errors to concise HTTP responses, preserving Retry-After on 429. */
export function respondLLMError(e: any) {
  const status = e?.status ?? e?.response?.status ?? 502;
  const retryAfter = e?.response?.headers?.get?.("retry-after");
  const res = NextResponse.json({ error: e?.message ?? "LLM error" }, { status });
  if (retryAfter) res.headers.set("Retry-After", String(retryAfter));
  return res;
}
```

## Observability

- `prompt_hash` is attached to JSON responses where LLM calls are proxied.

```70:87:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/enhancer/route.ts
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

```30:33:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/promptHash.ts
const DEBUG =
  process.env.DEBUG_PROMPTS === "1" ||
  process.env.NEXT_PUBLIC_DEBUG_PROMPTS === "1";
```
