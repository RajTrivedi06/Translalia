Purpose: Model defaults, env overrides, and feature flags for LLM surfaces.
Updated: 2025-09-16

# Flags & Models (2025-09-16)

## Model Defaults (env-driven)

- Centralized defaults with env overrides:

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

```2:15:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/models.ts
export const MODERATION_MODEL = "omni-moderation-latest";
```

```9:13:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/moderation.ts
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

```28:30:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

```14:16:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/enhancer/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_ENHANCER !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

```10:15:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/verify/route.ts
if (!isVerifyEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

```13:15:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/backtranslate/route.ts
if (!isBacktranslateEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

```1:3:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/flags/prismatic.ts
export function isPrismaticEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_PRISMATIC === "1";
}
```

```1:2:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/flags/interview.ts
// Deprecated: interview clarifier removed from client usage.
export const isSmartInterviewLLMEnabled = () => false;
```

Deprecated: server endpoint remains but is unused by client.

## Parameters we actually use

- Temperatures: Translator ≈0.6; Enhancer ≈0.2 (retry 0.1); Router ≈0.2; Verifier ≈0.2; Back-translate ≈0.3.
- `response_format: { type: "json_object" }`: used for JSON-returning surfaces (Enhancer/Router/Verifier/Backtranslate/Interview Clarifier).
- Unsupported: We do not use `min_p`.

Evidence:

```99:104:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const reqPayload = {
  model: TRANSLATOR_MODEL,
  temperature: 0.6,
  messages: [
```

```38:41:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/enhance.ts
const base = {
  model: ENHANCER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" } as const,
};
```

```60:61:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/enhance.ts
return openai.responses.create({
  ...base,
  temperature: 0.1,
```

```28:33:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/flow/intentLLM.ts
const r = await openai.responses.create({
  model: ROUTER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
```

```41:44:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/verify.ts
const r = await openai.responses.create({
  model: VERIFIER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
```

```83:87:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/verify.ts
const r = await openai.responses.create({
  model: BACKTRANSLATE_MODEL,
  temperature: 0.3,
  response_format: { type: "json_object" },
```

### Policy vs Implementation

- Policy: When a public feature flag is OFF, endpoints should return 403.
- Implementation differences:

```10:15:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/verify/route.ts
if (!isVerifyEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

```13:15:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/backtranslate/route.ts
if (!isBacktranslateEnabled())
  return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

## Where each model is used

- `TRANSLATOR_MODEL`
  - Preview: evidence of call and temp

```176:183:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const reqPayload = {
  model: TRANSLATOR_MODEL,
  temperature: 0.6,
  messages: [
    { role: "system", content: getTranslatorSystem(effectiveMode) },
    { role: "user", content: userPrompt },
  ],
}
```

```197:199:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const respUnknown: unknown = await openai.responses.create(
  reqPayload as unknown as Parameters<typeof openai.responses.create>[0]
);
```

- Translate:

```99:106:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const reqPayload = {
  model: TRANSLATOR_MODEL,
  temperature: 0.6,
  messages: [
    { role: "system", content: system },
    { role: "user", content: user },
  ],
```

- Instruct:

```147:154:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
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

```38:45:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/enhance.ts
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

```23:27:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/interview/next/route.ts
const r = await openai.responses.create({
  model: ROUTER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
```

- Router intent (server and lib):

```26:33:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/flow/intentLLM.ts
const r = await openai.responses.create({
  model: ROUTER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
  messages: [
```

```29:33:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/routeIntent.ts
const r = await openai.responses.create({
  model: ROUTER_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
```

- `VERIFIER_MODEL` / `BACKTRANSLATE_MODEL` (fallbacks from Router/Enhancer):

```12:15:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/verify.ts
const VERIFIER_MODEL = process.env.VERIFIER_MODEL?.trim() || ROUTER_MODEL;
const BACKTRANSLATE_MODEL =
  process.env.BACKTRANSLATE_MODEL?.trim() || ENHANCER_MODEL;
```

## Unsupported parameters

- There are no code references to `min_p` in this repo (older docs only).
