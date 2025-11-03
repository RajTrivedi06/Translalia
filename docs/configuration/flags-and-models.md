doc_purpose: "Normalize model defaults and feature flags; provide canonical maps"
audiences: ["devs","ops","prompt-engineers","LLM"]
version: "2025-09-23"
last_scanned_code_at: "2025-09-23"
evidence_policy: "anchors-required"

### Summary

Centralized inventory of model defaults, environment overrides, and feature flags used across translator, enhancer, router, verifier, and back-translation surfaces. Values here mirror `src/lib/models.ts` and flag helpers; tables include anchors to definitions and call-sites.

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
| Translator (Preview/Translate/Instruct) | `TRANSLATOR_MODEL`    | "gpt-5"                  | —                            | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/models.ts#L2-L2      |
| Enhancer (planner JSON)                 | `ENHANCER_MODEL`      | "gpt-5-mini"             | —                            | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/models.ts#L4-L5      |
| Router / Classifier                     | `ROUTER_MODEL`        | "gpt-5-nano-2025-08-07"  | —                            | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/models.ts#L7-L8      |
| Verifier (JSON)                         | `VERIFIER_MODEL`      | —                        | defaults to `ROUTER_MODEL`   | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/verify.ts#L12-L13 |
| Back-translate (JSON)                   | `BACKTRANSLATE_MODEL` | —                        | defaults to `ENHANCER_MODEL` | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/verify.ts#L13-L15 |
| Moderation                              | `MODERATION_MODEL`    | "omni-moderation-latest" | —                            | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/models.ts#L15-L15    |
| Embeddings                              | `EMBEDDINGS_MODEL`    | "text-embedding-3-large" | —                            | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/models.ts#L11-L12    |

Evidence:

```2:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/models.ts
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-5";

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
| Translator features             | `NEXT_PUBLIC_FEATURE_TRANSLATOR`               | 0       | {0,1}          | 403 from translator routes   | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/preview/route.ts#L34-L36 |
| Enhancer (planner)              | `NEXT_PUBLIC_FEATURE_ENHANCER`                 | 0       | {0,1}          | 403 from enhancer route      | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/enhancer/route.ts#L14-L16           |
| Prismatic variants              | `NEXT_PUBLIC_FEATURE_PRISMATIC`                | 0       | {0,1}          | Mode coerces to balanced     | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/flags/prismatic.ts#L1-L3                |
| Router intent                   | `NEXT_PUBLIC_FEATURE_ROUTER`                   | 0       | {0,1}          | Router returns null          | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/server/flow/intentLLM.ts#L11-L11            |
| Verify                          | `NEXT_PUBLIC_FEATURE_VERIFY`                   | 0       | {0,1}          | 404 from verify route        | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/flags/verify.ts#L1-L2                   |
| Back-translate                  | `NEXT_PUBLIC_FEATURE_BACKTRANSLATE`            | 0       | {0,1}          | 404 from backtranslate route | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/flags/verify.ts#L3-L4                   |
| Debug prompt previews           | `DEBUG_PROMPTS` or `NEXT_PUBLIC_DEBUG_PROMPTS` | 0       | {0,1}          | No redacted logs             | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/promptHash.ts#L30-L33                |
| Deprecated: Smart Interview LLM | `NEXT_PUBLIC_FEATURE_SMART_INTERVIEW_LLM`      | —       | —              | always disabled              | /Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/flags/interview.ts#L1-L2                |

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

```38:61:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/openai.ts
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

```68:83:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/openai.ts
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

### Cost & Caching Policy

- See Spend & Cache Policy document for detailed quotas and TTLs.
- JSON outputs use `response_format` where applicable to avoid repair calls; translator surfaces parse free‑form text.

### Known Gaps / TODOs

- Moderation call site uses a literal model string; consider wiring `MODERATION_MODEL` constant.

```45:49:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/ai/moderation.ts
const res = await client.moderations.create({
  model: "omni-moderation-latest",
  input: text.slice(0, 20000),
});
```

- `EMBEDDINGS_MODEL` exported but not referenced in call‑sites (confirm future use).

```11:12:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/models.ts
export const EMBEDDINGS_MODEL =
  process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-3-large";
```

- Verify/Backtranslate return 404 when disabled, while other features use 403; align policy.

```10:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/verify/route.ts
if (!isVerifyEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

```13:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/app/api/translator/backtranslate/route.ts
if (!isBacktranslateEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

### See Also

- LLM Integration Playbook: `docs/context/LLM_INTEGRATION_GUIDE.md` (registration schema, rate/cache patterns)

Purpose: Model defaults, env overrides, and feature flags for LLM surfaces.
Updated: 2025-09-16

# Flags & Models (2025-09-16)

## Model Defaults (env-driven)

- Centralized defaults with env overrides:

```2:15:/Users/raaj/Documents/CS/Translalia/Translalia-web/src/lib/models.ts
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-5";

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
| Translator (Preview/Translate/Instruct) | TRANSLATOR_MODEL                                    | "gpt-5"                  | `src/lib/models.ts:L2-L15`     | `src/app/api/translate/route.ts:L112-L118`; `src/app/api/translator/preview/route.ts:L268-L273`; `src/app/api/translator/instruct/route.ts:L222-L227` | Guard forbids moderation/embedding models `src/app/api/translator/preview/route.ts:L250-L258` |
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
