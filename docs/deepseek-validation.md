# DeepSeek Integration — Investigation & Validation Report

**Scope:** Validate the 7 gating assumptions for adding DeepSeek as a translation
provider via the Method 2 **chat-completions** path only (never `responsesCall`).
Driver for the proof: `modelOverride="deepseek-v4-flash"`.

**Status:** Investigation only — **no source files were modified.**

**Bottom line:** The plan is sound. `chatCompletionsWithRetry` already routes the
injected client (A2 ✅). The param helpers already produce DeepSeek-correct output
for a `deepseek-*` id with **no helper changes required** (A5/A6/A7 ✅). The real
work is threading a `getClientForModel(model)` resolver through main-gen **and**
regen — including one **direct singleton call in `regen.ts:518` that bypasses
`chatCompletionsWithRetry`** and must be patched separately. Several routing
nuances (recipe gen ignores the override; the HTTP route folds the override into
`guideAnswers` where a trailing spread can clobber it; DeepSeek `n>1` support) are
documented under **Surprises / risks**.

---

## A2 — Client injection (MOST IMPORTANT)

**Verdict: Confirmed.** `chatCompletionsWithRetry` uses the client passed as its
first argument; it does **not** import or reference the `openai` singleton.

Evidence — the file imports only the `OpenAI` **class**, never the singleton:

```ts
// src/lib/ai/chatCompletionsWithRetry.ts:8
import OpenAI from "openai";
```

Signature (first arg is the client, locally named `openai`):

```ts
// src/lib/ai/chatCompletionsWithRetry.ts:62-73
export async function chatCompletionsWithRetry(
  openai: OpenAI,
  params: ChatCompletionCreateParams,
  parseCallback?: (text: string) => unknown,
  instrumentation?: { ... },
  callKind?: "mainGen" | "regen" | "recipe",
  metadata?: { threadId?: string; lineIndex?: number; stanzaIndex?: number }
): Promise<ChatCompletion> {
```

Every `chat.completions.create` in the function uses that parameter:

```ts
// src/lib/ai/chatCompletionsWithRetry.ts:129
const result = await openai.chat.completions.create(nonStreamingParams);
// :192  (stop-sequence retry)
const retryResult = await openai.chat.completions.create(retryParams);
// :401  (unsupported-param retry)
const retryResult = await openai.chat.completions.create(retryParams);
```

Because there is no `import { openai } from "./openai"` in this file, the parameter
name `openai` is the injected client (no shadowing of the module singleton).
**Passing a DeepSeek-configured client here WILL route correctly. No change needed
to this function.**

---

## A3 — Regen call path

**Verdict: Partly true (action required).** `regenerateVariantWithSalvage` makes
its own model calls and uses the **imported `openai` singleton**. It accepts a
`model?` string but **not** a client. One of its three call sites is a **direct
singleton call that bypasses `chatCompletionsWithRetry`** and therefore will not be
fixed by client-threading-through-the-wrapper alone.

Singleton import:

```ts
// src/lib/ai/regen.ts:10
import { openai } from "./openai";
```

Signature — takes `model?`, no client:

```ts
// src/lib/ai/regen.ts:368-382
export async function regenerateVariantWithSalvage(
  worstIndex: number,
  fixedVariants: Array<{ label: "A" | "B" | "C"; text: string }>,
  recipe: VariantRecipe,
  recipes: VariantRecipesBundle,
  context: RegenContext,
  anchors: Anchor[] | undefined,
  gateReason: string,
  model?: string,
  options?: { ... }
): Promise<...>
// :397  const modelToUse = model ?? TRANSLATOR_MODEL;
```

Three model-call sites, **all bound to the singleton**:

```ts
// src/lib/ai/regen.ts:518  — GPT-4 batch path (if (!isGpt5 && K > 1)) — DIRECT, bypasses the wrapper
completion = await openai.chat.completions.create({
  model: modelToUse,
  ...buildSamplingParams(modelToUse, { temperature: 0.9 }),
  n: K,
  response_format: { type: "json_object" },
  ...getTokenLimitParam(modelToUse, regenMaxOutputTokens),
  ...
});

// src/lib/ai/regen.ts:643  — sequential path, via wrapper
completion = await chatCompletionsWithRetry(openai, { model: modelToUse, ... });

// src/lib/ai/regen.ts:783  — parallel path, via wrapper
const completion = await chatCompletionsWithRetry(openai, { model: modelToUse, ... });
```

`regenerateVariantWithSalvage` **does** receive the override-resolved model from the
Method 2 core:

```ts
// src/lib/translation/method2/translateLineWithRecipesInternal.ts:916-938
const regenResult = await regenerateVariantWithSalvage(
  idx, fixedVariants, recipeForLabel, recipes, { ... },
  anchors || [],
  initial.gateResult.reason || "distinctness_check_failed",
  model, // Pass user's selected model  (resolved at line 240, includes modelOverride)
  { ... }
);
```

**Implication:** for DeepSeek regen, resolve a client from `modelToUse` and use it at
**all three** sites — critically **line 518**, which is a direct `openai.*` call, not
a `chatCompletionsWithRetry` call. Threading a client only into the wrapper is
insufficient. Note `:518` also uses `n: K` (see risks).

---

## A1 — All singleton LLM call sites on the Method 2 path

**Verdict: Confirmed (inventory below).** None of the Method 2 path uses
`responses.create`; all use `chat.completions`. The only `responses.create` call
sites are in `responsesCall` (`openai.ts:70`, `:107`), which is **not** on the
Method 2 path.

| # | Call site | File:line | Mechanism | Client source | Model source | API |
|---|-----------|-----------|-----------|---------------|--------------|-----|
| 1 | Recipe gen (gpt-5 branch) | `variantRecipes.ts:845` | direct `openai.chat.completions.create` | singleton (`:752`) | `guideAnswers.translationModel ?? TRANSLATOR_MODEL` (`:830`) — **no modelOverride** | chat |
| 2 | Recipe gen (non-gpt-5) | `variantRecipes.ts:853` | direct | singleton | same as #1 | chat |
| 3 | Main-gen strict-schema | `translateLineWithRecipesInternal.ts:283` | `chatCompletionsWithRetry(openai, …)` | singleton → injected param | `model` (`:240`, includes modelOverride) | chat |
| 4 | Main-gen json_object fallback | `…Internal.ts:334` | `chatCompletionsWithRetry(openai, …)` | singleton → injected | `model` | chat |
| 5 | Main-gen json_object (default) | `…Internal.ts:371` | `chatCompletionsWithRetry(openai, …)` | singleton → injected | `model` | chat |
| 6 | Regen GPT-4 batch (`n=K`) | `regen.ts:518` | **direct** `openai.chat.completions.create` | singleton (`:10`) | `modelToUse` (override-aware) | chat |
| 7 | Regen sequential | `regen.ts:643` | `chatCompletionsWithRetry(openai, …)` | singleton → injected | `modelToUse` | chat |
| 8 | Regen parallel | `regen.ts:783` | `chatCompletionsWithRetry(openai, …)` | singleton → injected | `modelToUse` | chat |

**On the path but must be touched for DeepSeek to actually run on DeepSeek:**
#3–#8 (main-gen + regen). #1/#2 (recipes) are on the path but their model never
sees `modelOverride` (see risks) — leaving them unchanged means recipes run on the
default OpenAI model.

**Adjacent singleton sites NOT on the Method 2 line-translation path (leave alone):**

- `src/lib/ai/diversityGate.ts:1097`, `:1105` — inside `regenerateVariant` (`:1002`).
  The Method 2 file imports only `checkDistinctness` / `TranslationVariant` from
  `diversityGate` (`translateLineWithRecipesInternal.ts:35-37`), **not**
  `regenerateVariant`. That function is used by the notebook/prismatic route, not the
  workshop line path.
- `src/lib/workshop/translateLineInternal.ts:205/214/239` — legacy/Method-1 line path,
  separate from Method 2.
- `responsesCall` (`src/lib/ai/openai.ts:70`, `:107`) — uses `responses.create`. **Must
  never receive a DeepSeek model.** Not reachable from the Method 2 path, so no guard
  needed unless the resolver is wired somewhere into `responsesCall` (it should not be).
- Misc unrelated singleton callers (suggestions, alignment, notebook ai-assist, journey,
  verification routes) — out of scope.

---

## A4 — Model resolution

**Verdict: Confirmed (with a route-layer nuance — see risks).**

Core resolution is exactly as expected:

```ts
// src/lib/translation/method2/translateLineWithRecipesInternal.ts:239-240
const model =
  modelOverride ?? guideAnswers.translationModel ?? TRANSLATOR_MODEL;
```

The option field `model` is aliased to `modelOverride` on the way in:

```ts
// …Internal.ts:105-119
export async function translateLineWithRecipesInternal({
  ...
  model: modelOverride,
  ...
}: TranslateLineWithRecipesOptions): ...
```

`modelOverride` is a **free string** in the route schema:

```ts
// src/app/api/workshop/translate-line-with-recipes/route.ts:20
modelOverride: z.string().optional(),
```

So `"deepseek-v4-flash"` passes validation with no type/UI changes. **However**, the
HTTP route does not forward `modelOverride` to the internal call as `model`; it folds
it into `guideAnswers.translationModel` (see Surprises / risks #3). The cleanest proof
driver is to call `translateLineWithRecipesInternal({ ..., model: "deepseek-v4-flash" })`
directly, or POST with `modelOverride` to a thread whose stored `guide_answers` does
**not** already carry a `translationModel`.

`TRANSLATOR_MODEL` is a single env-driven id (no per-provider registry):

```ts
// src/lib/models.ts:2
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-4o";
```

---

## A5 / A6 / A7 — Param helpers for a `deepseek-v4-flash` id

**Verdict: Confirmed — all three already emit DeepSeek-correct params. No helper
change is required** (the helpers branch on `startsWith("gpt-5")`, which a `deepseek-*`
id does not match).

### A5 — `shouldUseStrictSchema` → `json_object` (not `json_schema`)

```ts
// src/lib/translation/method2/mainGenSchema.ts:55-65
export function shouldUseStrictSchema(model: string): boolean {
  const enabled = process.env.ENABLE_STRICT_JSON_SCHEMA !== "0"; // default on
  if (!enabled) return false;
  const allowedModels = process.env.STRICT_JSON_SCHEMA_MODELS
    ? process.env.STRICT_JSON_SCHEMA_MODELS.split(",").map((s) => s.trim())
    : ["gpt-5", "gpt-5-mini", "gpt-5-turbo"]; // default allowlist
  return allowedModels.some((allowed) => model.startsWith(allowed));
}
```

For `"deepseek-v4-flash"`: none of `gpt-5*` is a prefix → returns **`false`** →
`useStrictSchema` is false → main-gen takes the **`json_object`** branch
(`translateLineWithRecipesInternal.ts:371` with `response_format: { type: "json_object" }`).
**This is exactly what DeepSeek needs.** (Defense-in-depth: even if the allowlist were
widened to include deepseek, `isSchemaUnsupportedError` + `shouldFallbackToJsonObject`
fall back to `json_object`.)

### A6 — `getTokenLimitParam` → `max_tokens` (not `max_completion_tokens`)

```ts
// src/lib/ai/tokenLimitParam.ts:6-15
export function getTokenLimitParam(model: string, maxTokens: number) {
  const isGpt5 = model.startsWith("gpt-5");
  return isGpt5
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
}
```

For `"deepseek-v4-flash"`: `isGpt5 = false` → **`{ max_tokens }`**. Correct for DeepSeek.

### A7 — `buildSamplingParams` → `temperature` only (one sampling param)

```ts
// src/lib/ai/buildSamplingParams.ts:42-64
const isGpt5 = model.startsWith("gpt-5");
if (!isGpt5) {
  const params: SamplingParams = {};
  if (typeof config.temperature === "number") params.temperature = config.temperature;
  if (typeof config.top_p === "number") params.top_p = config.top_p;
  ...
  return params;
}
```

For `"deepseek-v4-flash"`: `isGpt5 = false` → returns the passed config verbatim. On the
Method 2 path the config only ever supplies `temperature` (main-gen `{ temperature: 0.7 }`
at `…Internal.ts:287/338/375`; regen `{ temperature: 0.9 }` at `regen.ts:520/560/576/647`),
so the result is **`{ temperature }` only — no `top_p`**. DeepSeek wants one of the two;
this satisfies it.

**Net for A5/A6/A7:** nothing must change in the helpers for `deepseek-v4-flash` to
behave correctly. (The wrapper's `isUnsupportedParamError` retry at
`chatCompletionsWithRetry.ts:378-427` is an additional safety net if DeepSeek rejects a
sampling param.)

---

## A6(home) — `getClientForModel` home & SDK capability

**Verdict: Confirmed.** The singleton is instantiated in `src/lib/ai/openai.ts`, which
is the cleanest place for a second DeepSeek client + the resolver.

```ts
// src/lib/ai/openai.ts:1-10
import OpenAI from "openai";
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  return openai;
}
```

`process.env.DEEPSEEK_API_KEY` is readable here (server module). The installed SDK
(`openai@4.104.0`, `package.json:30`) supports a custom `baseURL`:

```ts
// node_modules/openai/index.d.ts:44   baseURL?: string | null | undefined;
// node_modules/openai/index.d.ts:117  constructor({ baseURL, apiKey, organization, project, ...opts }?: ClientOptions);
```

So a resolver such as:

```ts
const deepseek = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY!, baseURL: "https://api.deepseek.com" });
export function getClientForModel(model: string): OpenAI {
  return model.startsWith("deepseek") ? deepseek : openai;
}
```

is the minimal, idiomatic addition. (Consider lazy/guarded construction so a missing
`DEEPSEEK_API_KEY` doesn't throw at import for non-DeepSeek runs.)

---

## A7(env/config) — Env & config

**Verdict: Confirmed.** `DEEPSEEK_API_KEY` is present in `.env.local`:

```
# translalia-web/.env.local:88
DEEPSEEK_API_KEY=<redacted>
```

(`OPENAI_API_KEY` at `:5`, `TRANSLATOR_MODEL` at `:34` also present.)

- `models.ts` reads model ids from env as single strings (`TRANSLATOR_MODEL`, plus
  `ENHANCER_MODEL`, `ROUTER_MODEL`, etc. per `config-and-env.md`), not a registry — so the
  DeepSeek id is supplied ad hoc via `modelOverride`/`TRANSLATOR_MODEL`, no registry edit
  needed for the proof.
- `specs/config.schema.json` **does** enumerate env vars (`OPENAI_API_KEY` required at
  `:8`/`:35`; `TRANSLATOR_MODEL` optional at `:63`) but has **no DeepSeek entry**.
- `docs/02-reference/config-and-env.md` lists `OPENAI_API_KEY` (`:7`/`:19`) under
  "Auth and Core Services" and `TRANSLATOR_MODEL` (`:27`) under "Model Selection" — also
  **no DeepSeek entry**.
- No `deepseek` references exist anywhere in `src/`, `docs/`, or `specs/` today — clean add.

To match convention, the build should add `DEEPSEEK_API_KEY` (and, if the base URL is
parameterized, `DEEPSEEK_BASE_URL`) to both `specs/config.schema.json` (under `properties`,
not `required`, since it's optional/provider-gated) and `docs/02-reference/config-and-env.md`
("Auth and Core Services" for the key; "Model Selection" if a DeepSeek model id env is added).

---

## Required changes (minimal, ordered)

1. **`src/lib/ai/openai.ts`** — add a DeepSeek `OpenAI` client
   (`baseURL: "https://api.deepseek.com"`, `apiKey: process.env.DEEPSEEK_API_KEY`) and a
   `getClientForModel(model)` resolver: `model.startsWith("deepseek") ? deepseek : openai`.
   Guard construction so a missing key doesn't throw for OpenAI-only runs.

2. **`src/lib/translation/method2/translateLineWithRecipesInternal.ts`** — replace the
   `openai` client argument in the three `chatCompletionsWithRetry(openai, …)` calls
   (`:283`, `:334`, `:371`) with `getClientForModel(model)`. (Model resolution at `:240`
   already handles the override — no change there.)

3. **`src/lib/ai/regen.ts`** — resolve `const client = getClientForModel(modelToUse)` once
   (after `:397`) and use it at **all three** sites:
   - **`:518`** — the **direct** `openai.chat.completions.create(...)` (GPT-4 batch path).
     This is the one that bypasses the wrapper; swap to `client.chat.completions.create(...)`.
     Also address `n: K` for DeepSeek (see risk #2).
   - `:643` and `:783` — change `chatCompletionsWithRetry(openai, …)` to
     `chatCompletionsWithRetry(client, …)`.

4. **(Optional — recipe parity)** **`src/lib/ai/variantRecipes.ts`** — if recipes should
   run on DeepSeek too, thread the override into the function and replace `openai` at
   `:845`/`:853` with `getClientForModel(modelToUse)`. Note `modelToUse` at `:830` is
   `guideAnswers.translationModel ?? TRANSLATOR_MODEL` and currently **ignores
   `modelOverride`**, so without this step recipes stay on the default OpenAI model.

5. **No change required** to `chatCompletionsWithRetry` (A2), `buildSamplingParams`,
   `getTokenLimitParam`, or `shouldUseStrictSchema` — they already produce DeepSeek-correct
   behavior for a `deepseek-*` id. (Optional hardening: ensure `STRICT_JSON_SCHEMA_MODELS`
   is not configured to include `deepseek`, which would force a `json_schema` attempt.)

6. **Docs/spec** — add `DEEPSEEK_API_KEY` (and optionally `DEEPSEEK_BASE_URL`) to
   `specs/config.schema.json` (`properties`, optional) and `docs/02-reference/config-and-env.md`.

---

## Surprises / risks

1. **`regen.ts:518` is a direct singleton call that bypasses `chatCompletionsWithRetry`.**
   Any "thread the client through the wrapper" change is incomplete unless this line is
   patched too. It is reached whenever `!isGpt5 && K > 1` — and DeepSeek is `!isGpt5`, so
   for non-focused modes (`K = 3` adventurous / `4` balanced per `regen.ts:403`) DeepSeek
   regen will hit this path.

2. **DeepSeek `n > 1` support is uncertain.** `regen.ts:518` requests `n: K` for multi-
   candidate batch generation. DeepSeek's chat-completions API historically does not honor
   `n > 1` the way OpenAI does. If DeepSeek rejects or ignores `n`, regen batch generation
   breaks or returns one candidate. Mitigations for the proof: drive regen in **focused**
   mode (`K = 1`, avoids the `n=K` branch entirely), or special-case DeepSeek to the
   sequential/parallel single-completion paths.

3. **Recipe generation ignores `modelOverride`.** `variantRecipes.ts:830` resolves
   `guideAnswers.translationModel ?? TRANSLATOR_MODEL` — no `modelOverride`. When the proof
   is driven purely by `modelOverride` (and the thread's stored `translationModel` is not
   DeepSeek), recipe generation runs on the **default OpenAI model**, while main-gen/regen
   run on DeepSeek. Functionally fine for a proof, but it means the run is mixed-provider
   unless step 4 is done.

4. **The HTTP route does not forward `modelOverride` to the internal call as `model`.** It
   folds the override into `guideAnswers.translationModel`
   (`route.ts:95-96`), and then **spreads the stored state last**:

   ```ts
   // route.ts:93-111
   const guideAnswers: GuideAnswers = {
     translationModel: modelOverride ?? thread.translation_model ?? guideAnswersState.translationModel ?? null,
     ...
     ...(guideAnswersState || {}),   // ← later keys win; can re-clobber translationModel
   };
   ```

   If the thread's persisted `guide_answers` JSONB already contains `translationModel`, the
   trailing spread overrides the override. **Most reliable proof driver:** call
   `translateLineWithRecipesInternal({ ..., model: "deepseek-v4-flash" })` directly, or POST
   `modelOverride` to a thread with no stored `translationModel` / set
   `thread.translation_model`.

5. **`json_object` "json" keyword requirement.** Like OpenAI, DeepSeek requires the literal
   word "json" somewhere in the messages when `response_format: { type: "json_object" }` is
   used. Regen's system prompt is `"You are a translation variant generator."`
   (`regen.ts:527/653/790`) — verify the regen user prompt (`promptText`) contains "json",
   or DeepSeek may 400. Main-gen prompts should be checked similarly.

6. **`deepseek-v4-flash` model id / base URL must be validated against DeepSeek's catalog.**
   DeepSeek's documented chat ids are typically `deepseek-chat` / `deepseek-reasoner`;
   confirm `deepseek-v4-flash` is a real, currently-served id before the proof, and confirm
   the base URL (`https://api.deepseek.com` vs `…/v1`). The OpenAI SDK appends `/chat/completions`.

7. **Stop sequences are model-agnostic but default-off.** `buildStopSequences`
   (`chatCompletionsWithRetry.ts:101`) is gated by `ENABLE_STOP_SEQUENCES === "1"`
   (`buildStopSequences.ts:35`, default off), so low risk. If enabled, it applies the same
   stops to DeepSeek; the wrapper already has a truncation/parse-failure fallback that retries
   without stops (`chatCompletionsWithRetry.ts:144-306`).

8. **`responsesCall` must stay OpenAI-only.** `openai.ts:70/107` use `responses.create`
   bound to the OpenAI singleton. It is not on the Method 2 path, but do not wire
   `getClientForModel` into it — DeepSeek has no Responses API.
