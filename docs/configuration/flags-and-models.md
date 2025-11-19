doc_purpose: "Central inventory of configuration envs, feature flags, and model selection"
audiences: ["devs","ops","prompt-engineers","LLM"]
version: "2025-11-04"
last_scanned_code_at: "2025-11-04"
evidence_policy: "anchors-required"

### Summary

This page lists all configuration environment variables, feature flags, and LLM model selection knobs used by the codebase. It also points to configuration files and provides defaults and examples.

## Environment Variables (names only)

Required at runtime in the web app:

- `OPENAI_API_KEY` — Server key for OpenAI SDK
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public)

Optional:

- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server‑side only)
- `DEBUG_PROMPTS`, `NEXT_PUBLIC_DEBUG_PROMPTS` — Enable prompt debug logging
- `STORAGE_BUCKETS_CORPORA` — Bucket name for corpora storage (defaults to `corpora`)
- `TRANSLATOR_MODEL`, `ENHANCER_MODEL`, `ROUTER_MODEL`, `EMBEDDINGS_MODEL` — Model overrides
- `NODE_ENV` — Standard Node environment

Evidence:

```2:6:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/env.ts
export const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};
```

```3:9:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
```

```4:4:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/storage.ts
export const BUCKET = process.env.STORAGE_BUCKETS_CORPORA ?? "corpora";
```

```2:12:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-4o";
export const ENHANCER_MODEL =
  process.env.ENHANCER_MODEL?.trim() || "gpt-5-mini";
export const ROUTER_MODEL =
  process.env.ROUTER_MODEL?.trim() || "gpt-5-nano-2025-08-07";
export const EMBEDDINGS_MODEL =
  process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-3-large";
```

```124:131:/Users/raaj/Documents/CS/metamorphs/docs/api/llm-api.md
  process.env.DEBUG_PROMPTS === "1" ||
  process.env.NEXT_PUBLIC_DEBUG_PROMPTS === "1";
```

## Feature Flags Matrix (current)

| Flag                                 | Default | Read In                                                                                                      | Gates                            | Impacted UI/APIs                                 | Notes                                 |
| ------------------------------------ | ------: | ------------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------ | ------------------------------------- |
| `NEXT_PUBLIC_FEATURE_TRANSLATOR`     |       0 | `src/app/api/translator/preview/route.ts#L32-L36`, `instruct/route.ts#L23-L27`, `translate/route.ts#L14-L18` | Translator preview/instruct APIs | `ChatPanel` flows; Plan Builder preview/instruct | Returns 403 when off.                 |
| `NEXT_PUBLIC_FEATURE_ENHANCER`       |       0 | `src/app/api/enhancer/route.ts#L12-L16`                                                                      | Enhancer API                     | Interview confirm/enhance steps                  | Returns 403 when off.                 |
| `NEXT_PUBLIC_FEATURE_PRISMATIC`      |       0 | `src/lib/flags/prismatic.ts#L1-L3`                                                                           | Prismatic mode UI                | Plan/Mode selectors                              | Coerces to balanced when off.         |
| `NEXT_PUBLIC_FEATURE_VERIFY`         |       0 | `src/lib/flags/verify.ts#L1-L2`, `src/app/api/translator/verify/route.ts#L10-L12`                            | Verify UI                        | Plan builder                                     | 404 when off (impl).                  |
| `NEXT_PUBLIC_FEATURE_BACKTRANSLATE`  |       0 | `src/lib/flags/verify.ts#L3-L4`, `src/app/api/translator/backtranslate/route.ts#L13-L15`                     | Back-translate UI                | Plan builder                                     | 404 when off (impl).                  |
| `NEXT_PUBLIC_FEATURE_ROUTER`         |       0 | `src/server/flow/intentLLM.ts#L11-L11`, `src/components/workspace/chat/ChatPanel.tsx#L403-L406`              | Server-assisted intent routing   | Chat intent only                                 | Fallback to local router if off.      |
| `NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT` |       0 | `src/lib/featureFlags.ts#L7-L9`, `src/components/workspace/v2/MainWorkspace.tsx#L14-L16`                     | V2 two-column shell              | V2 Workspace layout                              | Reversible rollout.                   |
| `NEXT_PUBLIC_FEATURE_CHAT_FIRST`     |       0 | `src/lib/featureFlags.ts#L10-L11`                                                                            | Chat-First surface               | Full-screen chat shell                           | Flag-only shell swap (UI only).       |
| `NEXT_PUBLIC_FEATURE_EXPLODE_DRAWER` |       0 | `src/lib/featureFlags.ts#L10-L11`                                                                            | Explode tokens drawer            | Token options UI                                 | Drawer is focus-trapped when on (UI). |

Rollout: All flags are reversible; no database migrations required.

### LLM Consumption

- **keys.model**: string (env‑overridable per surface)
- **keys.temperature**: number (translator ≈0.6; enhancer ≈0.2; router ≈0.2; verifier ≈0.2; backtranslate ≈0.3)
- **keys.response_format**: `{ type: "json_object" }` for JSON surfaces (enhancer/verifier/backtranslate/router)
- **keys.messages vs instructions/input**: message array for most calls; helper maps string user to `instructions`+`input`
- **schemas.prompt_hash (JSON)**:

```json
{
  "route": "string",
  "model": "string",
  "system": "string",
  "user": "string",
  "schema": "string?"
}
```

### Canonical Maps

#### MODELS_MAP

| Surface                                 | ENV/Const             | Default                  | Fallbacks                    | Anchor                                                                          |
| --------------------------------------- | --------------------- | ------------------------ | ---------------------------- | ------------------------------------------------------------------------------- |
| Translator (general text)               | `TRANSLATOR_MODEL`    | "gpt-4o"                 | —                            | /Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts#L2-L2      |
| Enhancer (planner JSON)                 | `ENHANCER_MODEL`      | "gpt-5-mini"             | —                            | /Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts#L4-L5      |
| Router / Classifier                     | `ROUTER_MODEL`        | "gpt-5-nano-2025-08-07"  | —                            | /Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts#L7-L8      |
| Embeddings                              | `EMBEDDINGS_MODEL`    | "text-embedding-3-large" | —                            | /Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts#L11-L12    |

Evidence:

```2:12:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-4o";

export const ENHANCER_MODEL =
  process.env.ENHANCER_MODEL?.trim() || "gpt-5-mini";

export const ROUTER_MODEL =
  process.env.ROUTER_MODEL?.trim() || "gpt-5-nano-2025-08-07";

export const EMBEDDINGS_MODEL =
  process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-3-large";

export const MODERATION_MODEL = "omni-moderation-latest";
```

```12:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/verify.ts
const VERIFIER_MODEL = process.env.VERIFIER_MODEL?.trim() || ROUTER_MODEL;
const BACKTRANSLATE_MODEL =
  process.env.BACKTRANSLATE_MODEL?.trim() || ENHANCER_MODEL;
```

#### FLAGS_MAP

| Flag                            | Env var                                        | Default | Allowed values | Effect when OFF              | Anchor                                                                                             |
| ------------------------------- | ---------------------------------------------- | ------- | -------------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Translator features             | `NEXT_PUBLIC_FEATURE_TRANSLATOR`               | 0       | {0,1}          | Helper only (no routes)      | /Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/featureFlags.ts#L4-L6                   |
| Enhancer (planner)              | `NEXT_PUBLIC_FEATURE_ENHANCER`                 | 0       | {0,1}          | Helper only (no routes)      | /Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/featureFlags.ts#L1-L3                   |
| Prismatic variants              | `NEXT_PUBLIC_FEATURE_PRISMATIC`                | 0       | {0,1}          | Not referenced               | —                                                                                                   |
| Sidebar layout                  | `NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT`           | 0       | {0,1}          | Switches to V2 shell         | /Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/featureFlags.ts#L7-L9                   |
| Debug prompt previews           | `DEBUG_PROMPTS` / `NEXT_PUBLIC_DEBUG_PROMPTS`  | 0       | {0,1}          | Enables prompt logs          | `docs/*` usage guidance                                                                              |

Evidence:

```33:36:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
    return new NextResponse("Feature disabled", { status: 403 });
  }
```

```14:16:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/enhancer/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_ENHANCER !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

```1:3:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/flags/prismatic.ts
export function isPrismaticEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_PRISMATIC === "1";
}
```

```10:12:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/server/flow/intentLLM.ts
export async function classifyIntentLLM(
  msg: string,
  phase: string
): Promise<null | { intent: string }> {
  if (process.env.NEXT_PUBLIC_FEATURE_ROUTER !== "1") return null;
```

```1:8:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/flags/verify.ts
export const isVerifyEnabled = () =>
  process.env.NEXT_PUBLIC_FEATURE_VERIFY === "1";
export const isBacktranslateEnabled = () =>
  process.env.NEXT_PUBLIC_FEATURE_BACKTRANSLATE === "1";
export const VERIFY_DAILY_LIMIT = Number(process.env.VERIFY_DAILY_LIMIT ?? 20);
export const BACKTRANSLATE_DAILY_LIMIT = Number(
  process.env.BACKTRANSLATE_DAILY_LIMIT ?? 10
);
```

```30:43:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/promptHash.ts
const DEBUG =
  process.env.DEBUG_PROMPTS === "1" ||
  process.env.NEXT_PUBLIC_DEBUG_PROMPTS === "1";
if (!DEBUG) return;
```

```1:2:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/flags/interview.ts
// Deprecated: interview clarifier removed from client usage.
export const isSmartInterviewLLMEnabled = () => false;
```

### LLM API Patterns

- All surfaces use OpenAI Responses API; helpers ensure non‑generative models drop unsupported params and add fallback when `temperature` is rejected.

```38:61:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
export async function responsesCall({
  model,
  system,
  user,
  temperature,
  top_p,
  response_format,
}: ResponsesCallOptions) {
  const args: Record<string, unknown> = { model };
  const nonGen = isNonGenerative(model);
  if (!nonGen && typeof temperature === "number")
    args.temperature = temperature;
  if (!nonGen && typeof top_p === "number") args.top_p = top_p;
  if (typeof user === "string") {
    args.instructions = system;
    args.input = user;
  } else {
    args.input = [{ role: "system", content: system }, ...user];
  }
  if (!nonGen && response_format) args.response_format = response_format;
  try {
    return await openai.responses.create(
      args as unknown as Parameters<typeof openai.responses.create>[0]
    );
  } catch (e: unknown) {
    // fallback on unsupported temperature
```

```68:83:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
    const unsupportedTemp = /Unsupported parameter:\s*'temperature'/i.test(msg);
    if (unsupportedTemp) {
      const retryArgs: Record<string, unknown> = { ...args };
      delete (retryArgs as Record<string, unknown> & { temperature?: unknown })
        .temperature;
      delete (retryArgs as Record<string, unknown> & { top_p?: unknown }).top_p;
      delete (
        retryArgs as Record<string, unknown> & { response_format?: unknown }
      ).response_format;
      if (process.env.NODE_ENV !== "production") {
        console.warn("[responsesCall:fallback:no-temperature]", { model });
      }
      return await openai.responses.create(
        retryArgs as unknown as Parameters<typeof openai.responses.create>[0]
      );
    }
    throw e;
  }
}
```

### Configuration files (locations and purposes)

- `translalia-web/next.config.ts` — Next config (security headers, image domains, ESLint build toggle)
```3:10:/Users/raaj/Documents/CS/metamorphs/translalia-web/next.config.ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { domains: ["images.unsplash.com"] },
  eslint: {
    // Temporarily ignore ESLint during builds
    ignoreDuringBuilds: true,
  },
```

- `translalia-web/eslint.config.mjs` — Flat ESLint config extending Next TS rules
```12:14:/Users/raaj/Documents/CS/metamorphs/translalia-web/eslint.config.mjs
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
```

- `translalia-web/tsconfig.json` — TS strict mode, bundler resolution, `@/*` alias
```2:6:/Users/raaj/Documents/CS/metamorphs/translalia-web/tsconfig.json
"strict": true,
"noEmit": true,
"moduleResolution": "bundler",
```

### Defaults and recommended settings

- Feature flags default to OFF (`0`); enable by setting to `"1"`.
- Models default as:
  - `TRANSLATOR_MODEL="gpt-4o"`
  - `ENHANCER_MODEL="gpt-5-mini"`
  - `ROUTER_MODEL="gpt-5-nano-2025-08-07"`
  - `EMBEDDINGS_MODEL="text-embedding-3-large"`
- Keep `DEBUG_PROMPTS` OFF in production.
- Use a dedicated Supabase project; never commit secrets.

### Configuration examples

Local `.env.local` for `translalia-web/`:

```bash
OPENAI_API_KEY=sk-****...abcd
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional UI flag
NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT=1

# Optional model overrides
TRANSLATOR_MODEL=gpt-4o
ENHANCER_MODEL=gpt-5-mini
ROUTER_MODEL=gpt-5-nano-2025-08-07
EMBEDDINGS_MODEL=text-embedding-3-large

# Debug (dev only)
DEBUG_PROMPTS=0
NEXT_PUBLIC_DEBUG_PROMPTS=0

# Optional storage bucket name
STORAGE_BUCKETS_CORPORA=corpora
```

Common scenarios:

- Enable the new workspace shell only:
```bash
NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT=1
```

- Override router to a nano model date tag:
```bash
ROUTER_MODEL=gpt-5-nano-2025-08-07
```

### Notes

- Some flags listed in historical docs (e.g., translator/enhancer gates) are defined in helpers but not referenced by routes in this snapshot.
- The prismatic API (`/api/notebook/prismatic`) exists and is not gated by a feature flag.

### See Also

- LLM Integration Playbook: `docs/context/LLM_INTEGRATION_GUIDE.md` (registration schema, rate/cache patterns)

Purpose: Model defaults, env overrides, and feature flags for LLM surfaces.
Updated: 2025-09-16

# Flags & Models (2025-09-16)

## Model Defaults (env-driven)

- Centralized defaults with env overrides:

```2:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/models.ts
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-4o";

export const ENHANCER_MODEL =
  process.env.ENHANCER_MODEL?.trim() || "gpt-5-mini";

export const ROUTER_MODEL =
  process.env.ROUTER_MODEL?.trim() || "gpt-5-nano-2025-08-07";

export const EMBEDDINGS_MODEL =
  process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-3-large";

export const MODERATION_MODEL = "omni-moderation-latest";
```

## MODELS_MAP

| Surface                                 | Constant / ENV (name only)                          | Default                  | Where set                      | Where used                                                                                                                                            | Notes                                                                                         |
| --------------------------------------- | --------------------------------------------------- | ------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Translator (Preview/Translate/Instruct) | TRANSLATOR_MODEL                                    | "gpt-4o"                 | `src/lib/models.ts:L2-L15`     | `src/app/api/translate/route.ts:L112-L118`; `src/app/api/translator/preview/route.ts:L268-L273`; `src/app/api/translator/instruct/route.ts:L222-L227` | Guard forbids moderation/embedding models `src/app/api/translator/preview/route.ts:L250-L258` |
| Enhancer (planner/JSON)                 | ENHANCER_MODEL                                      | "gpt-5-mini"             | `src/lib/models.ts:L2-L15`     | `src/lib/ai/enhance.ts:L37-L49`                                                                                                                       | JSON `response_format`                                                                        |
| Router / Classifier                     | ROUTER_MODEL                                        | "gpt-5-nano-2025-08-07"  | `src/lib/models.ts:L2-L15`     | `src/server/flow/intentLLM.ts:L26-L33`; `src/lib/ai/routeIntent.ts:L29-L37`; `src/app/api/interview/next/route.ts:L23-L31`                            | JSON output                                                                                   |
| Verifier                                | VERIFIER_MODEL (env) → fallback ROUTER_MODEL        | —                        | `src/lib/ai/verify.ts:L12-L15` | `src/lib/ai/verify.ts:L40-L48`                                                                                                                        | JSON scores                                                                                   |
| Back-translate                          | BACKTRANSLATE_MODEL (env) → fallback ENHANCER_MODEL | —                        | `src/lib/ai/verify.ts:L12-L15` | `src/lib/ai/verify.ts:L83-L91`                                                                                                                        | JSON back-translation                                                                         |
| Moderation                              | MODERATION_MODEL                                    | "omni-moderation-latest" | `src/lib/models.ts:L2-L15`     | Hard-coded in `src/lib/ai/moderation.ts:L9-L13`                                                                                                       | Policy vs Implementation below                                                                |
| Embeddings                              | EMBEDDINGS_MODEL                                    | "text-embedding-3-large" | `src/lib/models.ts:L2-L15`     | —                                                                                                                                                     | Defined, no call sites (TODO-VERIFY)                                                          |

### Policy vs Implementation

- We export `MODERATION_MODEL` but the call site uses a literal string.

```2:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/models.ts
export const MODERATION_MODEL = "omni-moderation-latest";
```

```9:13:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/moderation.ts
const res = await client.moderations.create({
  model: "omni-moderation-latest",
  input: text.slice(0, 20000),
});
```

> TODO-VERIFY: Align `lib/ai/moderation.ts` to use the exported constant if desired.

## Feature Flags (public)

- Policy intent: When a feature is OFF, endpoints should return 403.
- Implementation notes: Some endpoints currently return 404 when OFF (see anchors below).

| Flag                                      | Default | Effect when OFF (implementation)     |
| ----------------------------------------- | ------- | ------------------------------------ |
| `NEXT_PUBLIC_FEATURE_TRANSLATOR`          | 0       | Translator endpoints: 403            |
| `NEXT_PUBLIC_FEATURE_ENHANCER`            | 0       | Enhancer: 403                        |
| `NEXT_PUBLIC_FEATURE_PRISMATIC`           | 0       | Translator ignores prismatic mode    |
| `NEXT_PUBLIC_FEATURE_ROUTER`              | 0       | Router LLM disabled (returns null)   |
| `NEXT_PUBLIC_FEATURE_VERIFY`              | 0       | Verify: 404 (implementation)         |
| `NEXT_PUBLIC_FEATURE_BACKTRANSLATE`       | 0       | Back-translate: 404 (implementation) |
| `NEXT_PUBLIC_FEATURE_SMART_INTERVIEW_LLM` | —       | Deprecated (clarifier UI removed)    |
| `NEXT_PUBLIC_DEBUG_PROMPTS`               | 0       | No redacted prompt previews in logs  |

Evidence:

```28:30:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

```14:16:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/enhancer/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_ENHANCER !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

```10:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/verify/route.ts
if (!isVerifyEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

```13:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/backtranslate/route.ts
if (!isBacktranslateEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

```1:3:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/flags/prismatic.ts
export function isPrismaticEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_PRISMATIC === "1";
}
```

```1:2:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/flags/interview.ts
// Deprecated: interview clarifier removed from client usage.
export const isSmartInterviewLLMEnabled = () => false;
```

Deprecated: server endpoint remains but is unused by client.

## Parameters we actually use

- Temperatures: Translator ≈0.6; Enhancer ≈0.2 (retry 0.1); Router ≈0.2; Verifier ≈0.2; Back-translate ≈0.3.
- `response_format: { type: "json_object" }`: used for JSON-returning surfaces (Enhancer/Router/Verifier/Backtranslate/Interview Clarifier).
- Unsupported: We do not use `min_p`.

Evidence:

```99:104:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translate/route.ts
const reqPayload = {
  model: TRANSLATOR_MODEL,
  temperature: 0.6,
  messages: [
```

```38:41:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/enhance.ts
const base = {
  model: ENHANCER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" } as const,
};
```

```60:61:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/enhance.ts
return openai.responses.create({
  ...base,
  temperature: 0.1,
```

```28:33:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/server/flow/intentLLM.ts
const r = await openai.responses.create({
  model: ROUTER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
```

```41:44:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/verify.ts
const r = await openai.responses.create({
  model: VERIFIER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
```

```83:87:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/verify.ts
const r = await openai.responses.create({
  model: BACKTRANSLATE_MODEL,
  temperature: 0.3,
  response_format: { type: "json_object" },
```

### Policy vs Implementation

- Policy: When a public feature flag is OFF, endpoints should return 403.
- Implementation differences:

```10:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/verify/route.ts
if (!isVerifyEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

```13:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/backtranslate/route.ts
if (!isBacktranslateEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

## Where each model is used

- `TRANSLATOR_MODEL`
  - Preview: evidence of call and temp

```176:183:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
const reqPayload = {
  model: TRANSLATOR_MODEL,
  temperature: 0.6,
  messages: [
    { role: "system", content: getTranslatorSystem(effectiveMode) },
    { role: "user", content: userPrompt },
  ],
}
```

```197:199:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts
const respUnknown: unknown = await openai.responses.create(
  reqPayload as unknown as Parameters<typeof openai.responses.create>[0]
);
```

- Translate:

```99:106:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translate/route.ts
const reqPayload = {
  model: TRANSLATOR_MODEL,
  temperature: 0.6,
  messages: [
    { role: "system", content: system },
    { role: "user", content: user },
  ],
```

- Instruct:

```147:154:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/instruct/route.ts
const reqPayload = {
  model: TRANSLATOR_MODEL,
  temperature: 0.6,
  messages: [
    { role: "system", content: getTranslatorSystem(effectiveMode) },
    { role: "user", content: bundleUser },
  ],
}
```

- `ENHANCER_MODEL`
  - Enhance JSON (with retry):

```38:45:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/enhance.ts
const base = {
  model: ENHANCER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" } as const,
};

const r1 = await openai.responses.create({
  ...base,
  messages: [
```

- `ROUTER_MODEL`
  - Interview clarifier:

```23:27:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/interview/next/route.ts
const r = await openai.responses.create({
  model: ROUTER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
```

- Router intent (server and lib):

```26:33:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/server/flow/intentLLM.ts
const r = await openai.responses.create({
  model: ROUTER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
  messages: [
```

```29:33:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/routeIntent.ts
const r = await openai.responses.create({
  model: ROUTER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
```

- `VERIFIER_MODEL` / `BACKTRANSLATE_MODEL` (fallbacks from Router/Enhancer):

```12:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/verify.ts
const VERIFIER_MODEL = process.env.VERIFIER_MODEL?.trim() || ROUTER_MODEL;
const BACKTRANSLATE_MODEL =
  process.env.BACKTRANSLATE_MODEL?.trim() || ENHANCER_MODEL;
```

## Unsupported parameters

- There are no code references to `min_p` in this repo (older docs only).

## NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT

- Type: UI Flag (client-visible)
- Default: 0 (off)
- When "1": `/workspaces/[projectId]/threads/[threadId]` renders the new V2 shell.
- When "0": legacy `WorkspaceShell` remains.
- No server behavior is gated by this flag.

Evidence:

```7:12:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/featureFlags.ts
export function isSidebarLayoutEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT === "1";
}
```

```1:16:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/(app)/workspaces/[projectId]/threads/[threadId]/page.tsx
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { isSidebarLayoutEnabled } from "@/lib/featureFlags";
import { WorkspaceV2Shell } from "@/components/workspace/v2/WorkspaceV2Shell";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ projectId: string; threadId: string }>;
}) {
  const { projectId, threadId } = await params;
  const sidebarEnabled = isSidebarLayoutEnabled();
  if (sidebarEnabled) {
    return <WorkspaceV2Shell projectId={projectId} threadId={threadId} />;
  }
  return <WorkspaceShell projectId={projectId} threadId={threadId} />;
}
```
