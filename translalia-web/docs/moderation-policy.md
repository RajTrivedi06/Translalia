Purpose: Where and how moderation is enforced, and current/intent policies.
Updated: 2025-11-04

# Moderation Policy (2025-11-04)

## Current moderation implementation

- Model: `omni-moderation-latest` via OpenAI Moderations API.
- Helper: `moderateText(text)` trims input to first 20k chars and returns `{ flagged, categories }`.

```10:13:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/moderation.ts
const res = await client.moderations.create({
  model: "omni-moderation-latest",
  input: text.slice(0, 20000),
});
```

```16:20:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/moderation.ts
const flagged = !!first?.flagged;
const categories: Record<string, unknown> = first?.categories ?? {};
return { flagged, categories };
```

Note: In this repository snapshot, no API routes currently call `moderateText`. The helper is available for pre/post screening when added to endpoints.

## Rate limiting

- In-memory token bucket helper exists:

```1:8:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/ratelimit.ts
const buckets = new Map<string, { count: number; until: number }>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
```

- Daily quotas stubbed via Redis helper; currently returns allowed for all requests:

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

- Example usage sites apply `checkDailyLimit` and respond with 429 when exceeded (once enabled):

```83:99:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
// Rate limiting: 10 requests per minute per thread
const rateCheck = await checkDailyLimit(
  user.id,
  `notebook:ai-assist:${threadId}`,
  10 * 60 // 10 per minute = 600 per day
);
if (!rateCheck.allowed) {
  return NextResponse.json(
    { error: "Rate limit exceeded", current: rateCheck.current, max: rateCheck.max },
    { status: 429 }
  );
}
```

## Input validation and sanitization

- Requests are validated with Zod schemas; invalid inputs return 400 with issue details.

```15:21:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/workshop/generate-options/route.ts
const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  lineText: z.string(),
});
```

```41:49:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/workshop/generate-options/route.ts
const body = await req.json();
const validation = RequestSchema.safeParse(body);
if (!validation.success) {
  return NextResponse.json(
    { error: "Invalid request", details: validation.error.issues },
    { status: 400 }
  );
}
```

- Responses from LLM calls are parsed and validated; malformed responses return 500.

```201:209:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
let parsed;
try {
  parsed = JSON.parse(text);
} catch (parseError) {
  return NextResponse.json(
    { error: "Invalid AI response format" },
    { status: 500 }
  );
}
```

## Blocked content patterns

- We rely on provider categories from OpenAI Moderations to determine `flagged` status; we do not maintain custom pattern lists.
- Inputs to moderation are truncated to 20,000 chars to bound payload size.

```10:13:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/moderation.ts
input: text.slice(0, 20000),
```

## Moderation endpoints

- There are no public “moderation endpoints”. Moderation is intended to be applied inside API routes as pre/post checks using `moderateText`.

## Authentication and middleware

- Middleware enforces auth on protected paths and redirects to sign-in when missing session cookies.

```27:41:/Users/raaj/Documents/CS/metamorphs/translalia-web/middleware.ts
const needsAuth =
  pathname.startsWith("/workspaces") ||
  pathname.startsWith("/api/threads") ||
  pathname.startsWith("/api/flow") ||
  pathname.startsWith("/api/versions");
...
if (needsAuth && !hasSupabaseCookies) {
  const url = new URL("/auth/sign-in", origin);
  url.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}
```

## Appeals/overrides

- No formal appeal or override process exists in this codebase snapshot. If content is incorrectly flagged once moderation is enforced on endpoints, the response will be a 4xx JSON error; clients should present a retry/edit UI.

## Future intent

- Apply `moderateText` to user-submitted text pre‑LLM and to LLM outputs post‑generation on sensitive surfaces.
- Use in-memory `rateLimit` for hot endpoints and enable daily quotas via Redis when dependencies are installed.
