### [Last Updated: 2025-11-04]

## Current Issues

### Active bugs
- Preview echo persists first‑pass output (priority: medium)
  - Symptoms: preview sometimes shows echoed lines even after retry logic
  - Evidence
    ```298:306:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
    // retry & fallback logic exists but ensure final data bound before persist
    ```
    ```250:254:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
    // Return result (caching disabled for now)
    const response = { variants };
    return ok(response);
    ```
  - Suspected cause: not all branches rebind parsed retry output before persistence/cache
  - Workaround: manual retry in UI; verify lines before accept
  - Status: open

- 403 on nodes after rapid thread switch (priority: low)
  - Symptoms: canvas briefly shows 403 until next poll
  - Evidence
    ```38:45:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/hooks/useNodes.ts
    return useQuery({ queryKey: ["nodes", projectId, threadId], /* ... */ refetchInterval: enabled ? 1500 : false });
    ```
    ```21:30:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/versions/nodes/route.ts
    const { data: th } = await sb.from("chat_threads").select("id, project_id").eq("id", threadId).single();
    if (!th) return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403 });
    ```
  - Suspected cause: auth/session handoff races with polling
  - Workaround: pause polling during thread change; backoff on 403
  - Status: open

### Technical debt
- Redis quota limiter stubbed (needs Upstash integration)
  - Evidence
    ```1:6:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ratelimit/redis.ts
    // Rate limiting disabled for now (requires @upstash/redis and @upstash/ratelimit)
    export function getLimiter() { return null; }
    ```
  - Impact: only in‑memory per‑minute limits available; no global daily quotas
  - Priority: medium

- Mixed feature flag usage and hard‑coded moderation model
  - Evidence
    ```8:20:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/moderation.ts
    model: "omni-moderation-latest",
    ```
  - Impact: model not centrally overridden; env consistency
  - Priority: low

### Planned refactors
- Centralize error responses and envelopes across routes
  - Evidence
    ```1:23:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/http/errors.ts
    export function jsonError(/* ... */)
    ```
  - Plan: adopt `withError` wrapper and standardized error envelopes in all handlers

- Extract LLM adapters for multi‑provider support
  - Evidence
    ```37:85:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
    export async function responsesCall(/* ... */)
    ```
  - Plan: define provider interface and env‑select adapter

### Performance issues
- LLM latency on cold prompts; cache coverage not universal
  - Evidence
    ```13:29:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/cache.ts
    export async function cacheGet/Set(/* ... */)
    ```
  - Plan: expand caching to additional deterministic endpoints; add hit/miss metrics

- Polling when view not visible
  - Evidence
    ```38:45:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/hooks/useNodes.ts
    refetchInterval: enabled ? 1500 : false
    ```
  - Plan: gate by current view; pause on non‑workshop

### Feature limitations
- No streaming responses implemented
  - Evidence: all LLM routes use non‑streaming calls
  - Impact: slower perceived latency; no incremental UX

- No external monitoring/metrics
  - Evidence: console logging only
  - Impact: limited observability in prod

### Breaking changes needed (future)
- Journey items `thread_id` physical column
  - Evidence: current filters use `meta->>thread_id`
  - Impact: migration + code change to `.eq("thread_id", ...)`

### Deprecation notices
- Legacy guide structured fields kept optional; moving to free‑form `translationIntent`
  - Evidence
    ```14:27:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/store/guideSlice.ts
    // Legacy structured fields are kept optional …
    ```

### Workarounds in place
- ErrorBoundary for UI crash containment
  - Evidence
    ```49:56:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/common/ErrorBoundary.tsx
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) { console.error("[ErrorBoundary]", error, errorInfo); }
    ```

- Retry and model fallback for LLM errors
  - Evidence
    ```200:238:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
    if (shouldFallback) { /* switch to gpt-4o */ } else { return err(502, "OPENAI_FAIL", /* ... */); }
    ```

- Thread‑scoped local persistence to avoid state leaks across threads
  - Evidence
    ```28:47:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/threadStorage.ts
    const key = tid ? `${name}:${tid}` : `${name}:__global__`;
    ```
