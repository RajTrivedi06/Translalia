Purpose: Error taxonomy, status usage, Retry-After policy vs implementation.
Updated: 2025-11-04

### [Last Updated: 2025-11-04]

# Error Handling (2025-11-04)

## Strategy
- Server: standardize JSON error envelopes; validate inputs with Zod; early returns for auth/ownership; include machine `code` where applicable.
- Client: non-throwing UI; use toasts and inline messages; keep forms usable after failures; skeletons for loading.
- LLM: fallback to supported models when requested model is unavailable; surface concise upstream errors.
- Observability: structured console logs with `requestId`; optional prompt hashing and debug flags in dev.

## Helpers and types
- HTTP helpers for upstream and generic errors:
```1:23:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/http/errors.ts
import { NextResponse } from "next/server";

/** Convert LLM client errors to concise HTTP responses, preserving Retry-After on 429. */
export function respondLLMError(e: any) {
  const status = e?.status ?? e?.response?.status ?? 502;
  const retryAfter = e?.response?.headers?.get?.("retry-after");
  const body = { error: e?.message ?? "LLM error" } as const;
  const res = NextResponse.json(body, { status });
  if (retryAfter) res.headers.set("Retry-After", String(retryAfter));
  return res;
}

export function jsonError(
  status: number,
  message: string,
  opts?: { retryAfterSec?: number }
) {
  const res = NextResponse.json({ error: message }, { status });
  if (opts?.retryAfterSec) {
    res.headers.set("Retry-After", String(opts.retryAfterSec));
  }
  return res;
}
```

- Wrapper to normalize unhandled exceptions:
```25:46:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/http/errors.ts
/** Wrap a route handler to standardize unhandled error responses. */
export function withError<
  TReq extends Request | import("next/server").NextRequest,
  TRes extends Response
>(handler: (req: TReq) => Promise<TRes>): (req: TReq) => Promise<TRes> {
  return async (req: TReq) => {
    try {
      return await handler(req);
    } catch (e: any) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[route:error]", e);
      }
      const status = e?.statusCode || e?.status || 500;
      const msg =
        status >= 500
          ? "Internal Server Error"
          : e?.message || "Request failed";
      return jsonError(status, msg) as unknown as TRes;
    }
  };
}
```

## API error envelopes and status codes
- Common envelope (notebook/guide routes): `{ error: { code, message, ...extra } }`
```20:24:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}
```

- Alternate envelope in list endpoints: `{ ok: false, code }`
```8:15:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/threads/list/route.ts
export async function GET(req: NextRequest) {
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { ok: false, code: "MISSING_PROJECT_ID" },
      { status: 400 }
    );
  }
}
```

- Auth failures return 401 JSON:
```4:15:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/auth/requireUser.ts
/** Ensures a user session exists; returns 401 JSON response otherwise. */
export async function requireUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return {
      user: null as any,
      response: NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 }
      ),
    };
  }
  return { user: data.user, response: null as any };
}
```

### Status usage (observed)
- 400: invalid/missing parameters
- 401: unauthenticated
- 403: forbidden (ownership/feature off)
- 404: not found
- 409: conflicting state (e.g., locked cell)
- 429: rate-limited (policy recommends Retry-After)
- 500: unexpected server error
- 502: upstream/LLM contract invalid

Examples:
```8:15:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/uploads/list/route.ts
if (!user)
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```
```84:92:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
if (threadErr || !thread) {
  log("thread_not_found", threadErr?.message);
  return err(404, "THREAD_NOT_FOUND", "Thread not found.");
}
if (thread.created_by !== user.id) {
  log("forbidden", { userId: user.id, owner: thread.created_by });
  return err(403, "FORBIDDEN", "You do not have access to this thread.");
}
```
```117:121:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/locks/route.ts
if (updateErr) {
  log("update_fail", updateErr.message);
  return err(500, "UPDATE_FAILED", "Failed to update locks.");
}
```

## Retry-After and rate limiting
- Policy: include `Retry-After` on 429s (e.g., 60s for minute bucket, 86400s for daily quotas).
- Implementation: helper supports setting the header; ensure routes set it when returning 429.
```13:23:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/http/errors.ts
export function jsonError(
  status: number,
  message: string,
  opts?: { retryAfterSec?: number }
) {
  const res = NextResponse.json({ error: message }, { status });
  if (opts?.retryAfterSec) {
    res.headers.set("Retry-After", String(opts.retryAfterSec));
  }
  return res;
}
```

## LLM retry and fallback
- GPT-5 to GPT-4 family fallback on unsupported params or missing model; 502 on non-retryable upstream errors.
```200:238:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
} catch (modelError: any) {
  const shouldFallback =
    modelError?.error?.code === "model_not_found" ||
    modelError?.status === 404 ||
    modelError?.status === 400;
  if (shouldFallback) {
    log("fallback_to_gpt4", { from: modelToUse, to: "gpt-4o", reason: modelError?.error?.code || modelError?.error?.message || "error" });
    modelToUse = "gpt-4o";
    completion = await openai.chat.completions.create({ /* ... */ });
  } else {
    log("openai_fail", modelError?.message);
    return err(502, "OPENAI_FAIL", "Upstream prismatic generation failed.", { upstream: String(modelError?.message ?? modelError) });
  }
}
```
```125:154:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/guide/analyze-poem/route.ts
} catch (modelError: any) {
  const shouldFallback =
    modelError?.error?.code === 'model_not_found' ||
    modelError?.status === 404 ||
    modelError?.status === 400;
  if (shouldFallback) {
    log("fallback_to_gpt4", { from: modelToUse, to: "gpt-4o-mini", reason: modelError?.error?.code || modelError?.error?.message || 'error' });
    modelToUse = "gpt-4o-mini";
    completion = await openai.chat.completions.create({ /* ... */ });
  } else {
    log("openai_fail", modelError?.message);
    return err(502, "OPENAI_FAIL", "Upstream analysis failed.", { upstream: String(modelError?.message ?? modelError) });
  }
}
```

## Logging and monitoring
- Structured logs per request with `requestId`, timing, and phase labels; console only (no external monitoring wired).
```30:35:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
const requestId = crypto.randomUUID();
const started = Date.now();
const log = (...a: any[]) =>
  console.log("[/api/notebook/prismatic]", requestId, ...a);
```
```24:28:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/guide/analyze-poem/route.ts
const requestId = crypto.randomUUID();
const started = Date.now();
const log = (...a: any[]) => console.log("[/api/guide/analyze-poem]", requestId, ...a);
```

## Client-side user messaging
- Use toasts and inline messages; avoid throwing in UI flows; keep composer/forms interactive.
```210:216:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/workspace/chat/ChatPanel.tsx
if (!res.ok) {
  const json = await res.json().catch(() => ({}));
  toastError(json?.error || "Failed to send");
  return;
}
```
```221:227:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/workspace/chat/ChatPanel.tsx
try {
  assertOnline();
} catch (e) {
  const msg = e instanceof Error ? e.message : "You’re offline — try again later.";
  toastError(msg);
  return;
}
```
- Loading skeletons instead of blocking spinners; inline error copy for panes.
```166:173:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
{loading && (
  <div aria-busy="true" aria-live="polite" className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
    ))}
  </div>
)}
```
```179:181:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/workspace/v2/sidebar/SourceTextCard.tsx
{!loading && error && (
  <p className="text-sm text-red-600 dark:text-red-400">{t("couldNotLoadSource")}</p>
)}
```

## Circuit breakers and recovery
- Circuit breakers: none centralized; upstream failure short-circuits the specific request with 502 and a concise error envelope.
- Recovery strategies:
  - LLM fallback (see above)
  - Non-blocking persistence: operations may succeed without saving secondary state
```160:170:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/guide/analyze-poem/route.ts
const { error: saveErr } = await supabase
  .from("chat_threads")
  .update({ state: newState })
  .eq("id", body.threadId);
if (saveErr) {
  log("save_fail", saveErr.message);
  return ok({ analysis, saved: false });
}
```
  - UI continues after auxiliary failures; errors surfaced via toasts.
```233:235:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/workspace/chat/ChatPanel.tsx
} catch {
  // ignore and proceed; errors surface via toasts elsewhere
}
```

## Recommended response format (server)
- Prefer one of these envelopes consistently:
  - Error object: `{ error: { code, message, details? } }`
  - Boolean flag: `{ ok: false, code, error? }`
- Include `Retry-After` when returning 429s and when proxying upstream 429s.

## Example: Proper route error handling
```1:52:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/locks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  lineIndex: z.number().int().min(0),
  wordPositions: z.array(z.number().int().min(0)),
});

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as any, { status });
}
function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (...a: any[]) => console.log("[/api/notebook/locks]", requestId, ...a);
  try {
    let body = BodySchema.parse(await req.json());
    // ... auth, ownership, conflict checks
  } catch (e: any) {
    console.error("[/api/notebook/locks] fatal", e);
    return err(500, "INTERNAL", "Internal server error");
  }
}
```

## Monitoring
- Current: console-based. Consider wiring a structured logger and external sink (e.g., Logtail/Datadog/Sentry) with request correlation IDs and redaction.
