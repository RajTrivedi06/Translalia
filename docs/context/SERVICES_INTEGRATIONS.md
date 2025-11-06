Purpose: External services used (Supabase, OpenAI, Upstash), usage points, and env names.
wUpdated: 2025-11-04

### [Last Updated: 2025-11-04]

# Services & Integrations (2025-11-04)

## Supabase (Auth + DB + Storage)

- SSR client creation

```7:16:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/supabaseServer.ts
return createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { cookies: {/* implemented per middleware/request */} }
);
```

- Browser client for hooks

```4:5:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/supabaseClient.ts
process.env.NEXT_PUBLIC_SUPABASE_URL || "",
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
```

- Auth guard (cookies → Bearer fallback)

```12:22:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/apiGuard.ts
export async function requireUser(req: NextRequest): Promise<GuardOk | GuardFail> {
  // 1) cookies → SSR helper
  // 2) Authorization: Bearer <token>
}
```

- Storage usage (avatars bucket)

```150:154:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/account/ProfileForm.tsx
const { error: upErr } = await supabase.storage
  .from("avatars")
  .upload(path, file, { upsert: true });
```

- Configuration (names only)
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- SDKs
  - `@supabase/ssr`, `@supabase/supabase-js`
- Error handling
  - 401 JSON when no session (guard), 403/404 on ownership/RLS, 500 on DB errors

```8:15:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/uploads/list/route.ts
if (!user)
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

- Testing locally
  - Create a Supabase project; set envs; sign-in via UI; verify `/api/auth/whoami` returns uid

## OpenAI (LLM: Chat/Responses/Moderation)

- Client singleton and getter

```1:10:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, });
export function getOpenAI() { if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing"); return openai; }
```

- Responses adapter with GPT‑5 param fallback

```37:85:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
export async function responsesCall({ model, system, user, temperature, top_p, response_format }: ResponsesCallOptions) { /* strips unsupported params and retries */ }
```

- Moderation

```8:20:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/moderation.ts
const res = await client.moderations.create({ model: "omni-moderation-latest", input: text.slice(0, 20000) });
```

- Model selection via env

```1:8:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-5";
export const ENHANCER_MODEL = process.env.ENHANCER_MODEL?.trim() || "gpt-5-mini";
export const ROUTER_MODEL = process.env.ROUTER_MODEL?.trim() || "gpt-5-nano-2025-08-07";
export const EMBEDDINGS_MODEL = process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-3-large";
```

- Configuration (names only)
  - `OPENAI_API_KEY`, optional `TRANSLATOR_MODEL`, `ENHANCER_MODEL`, `ROUTER_MODEL`, `EMBEDDINGS_MODEL`
- SDKs
  - `openai`
- Error handling and fallback
  - GPT‑5 param removal; model fallback to `gpt-4o`/`gpt-4o-mini`; 502 with concise envelope on upstream failure

```200:238:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
} catch (modelError: any) {
  const shouldFallback = /* 400/404/model_not_found */
  if (shouldFallback) { /* switch to gpt-4o and retry */ } else { return err(502, "OPENAI_FAIL", "Upstream prismatic generation failed.", { upstream: String(modelError?.message ?? modelError) }); }
}
```

- Cost considerations
  - Prefer caching idempotent results; rate-limit hot endpoints; use smaller models for routing/enhancing where acceptable
- Testing locally
  - Set `OPENAI_API_KEY`; run routes like `/api/guide/analyze-poem` and `/api/notebook/prismatic`; verify JSON output

## Upstash Redis (Daily quotas; optional)

- Helper (may be stubbed if client not configured)

```176:191:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ratelimit/redis.ts
export async function checkDailyLimit(userId: string, key: string, max: number) { /* incr with 24h TTL; returns allowed/current/max */ }
```

- Usage example (rate 429)

```83:99:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
const rateCheck = await checkDailyLimit(user.id, `notebook:ai-assist:${threadId}`, 10 * 60);
if (!rateCheck.allowed) { return NextResponse.json({ error: "Rate limit exceeded", current: rateCheck.current, max: rateCheck.max }, { status: 429 }); }
```

- Configuration (names only)
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- SDKs
  - `@upstash/redis`, `@upstash/ratelimit` (if enabled)
- Error handling & fallback
  - If Redis client absent, helper allows by default; API still protected by local per-minute limiter when implemented
- Testing locally
  - Omit envs to effectively disable daily quotas; rely on in-memory limiter for basic protection

## Feature flags (exposure control)

- Routes gated by `NEXT_PUBLIC_FEATURE_*`

```28:31:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/translator/preview/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

## Other providers

- No Stripe/S3/Sendgrid integrations found in code.

## Local integration testing checklist

- Set required envs
  - Supabase URL & anon key; OpenAI API key; optional Redis
- Validate auth & cookies
  - Hit `/api/auth/whoami` to confirm uid; access a protected route and expect redirect when unauthenticated
- Exercise LLM endpoints
  - `POST /api/guide/analyze-poem` and `/api/notebook/prismatic` with minimal payloads; expect strict JSON
- Verify storage
  - Upload an avatar in Profile to confirm bucket permissions

> Redaction: Do not print secret values. List env names only.
