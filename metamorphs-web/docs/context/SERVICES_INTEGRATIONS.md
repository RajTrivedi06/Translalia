Purpose: External services used (Supabase, OpenAI, Upstash), usage points, and env names.
Updated: 2025-09-16

### [Last Updated: 2025-09-16]

# Services & Integrations (2025-09-16)

## Supabase (Auth + DB)

- SSR client creation:

```7:10:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/supabaseServer.ts
return createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
```

- Client (browser) for hooks:

```4:5:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/supabaseClient.ts
process.env.NEXT_PUBLIC_SUPABASE_URL || "",
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
```

- Guarded routes pattern:

```16:19:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/route.ts
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
```

Required envs (names only): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## OpenAI (LLM)

- API key usage and validation:

```1:5:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/openai.ts
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
```

```7:10:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/openai.ts
export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  return openai;
}
```

- Model defaults and env overrides (names only):
  - `TRANSLATOR_MODEL`, `ENHANCER_MODEL`, `ROUTER_MODEL`, `EMBEDDINGS_MODEL`, `MODERATION_MODEL`

```2:15:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/models.ts
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-5";
export const ENHANCER_MODEL =
  process.env.ENHANCER_MODEL?.trim() || "gpt-5-mini";
export const ROUTER_MODEL =
  process.env.ROUTER_MODEL?.trim() || "gpt-5-nano-2025-08-07";
export const EMBEDDINGS_MODEL =
  process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-3-large";
export const MODERATION_MODEL = "omni-moderation-latest";
```

- Optional: `VERIFIER_MODEL`, `BACKTRANSLATE_MODEL`

```12:15:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/verify.ts
const VERIFIER_MODEL = process.env.VERIFIER_MODEL?.trim() || ROUTER_MODEL;
const BACKTRANSLATE_MODEL =
  process.env.BACKTRANSLATE_MODEL?.trim() || ENHANCER_MODEL;
```

- Moderation note (Policy vs Implementation):

```9:13:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/moderation.ts
const res = await client.moderations.create({
  model: "omni-moderation-latest",
  input: text.slice(0, 20000),
});
```

> TODO-VERIFY: Although `MODERATION_MODEL` is exported in `lib/models.ts`, the moderation call uses a hard-coded literal.

Required envs (names only): `OPENAI_API_KEY`, `TRANSLATOR_MODEL`, `ENHANCER_MODEL`, `ROUTER_MODEL`, `EMBEDDINGS_MODEL`, optional `VERIFIER_MODEL`, `BACKTRANSLATE_MODEL`.

## Upstash Redis (Quotas)

- Daily quota helper:

```1:3:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ratelimit/redis.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
```

- Verify/back-translate routes use daily limits:

```18:23:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/verify/route.ts
const rl = await checkDailyLimit(user.id, "verify", VERIFY_DAILY_LIMIT);
if (!rl.allowed)
  return NextResponse.json(
    { error: "Daily verification limit reached" },
    { status: 429 }
  );
```

Required envs (names only): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

## Feature Flags (exposure control)

- Routes gate access via `NEXT_PUBLIC_FEATURE_*`.

```28:30:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

## Other providers

- No Stripe/S3/Sendgrid integrations found in code.

> Redaction: Do not print secret values. List env names only.
