### [Last Updated: 2025-11-04]

## LLM Integration Guide

### Providers

- Integrated: OpenAI (chat.completions, responses API, moderation)
- Not integrated: Anthropic, Google, etc. (see "Add a new provider")

```1:10:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  return openai;
}
```

### Client initialization and configuration

- Use a singleton `openai` with the server-side `OPENAI_API_KEY`.
- Helper `responsesCall` adapts inputs for OpenAI Responses API and strips unsupported params on GPT‑5 models.

```12:21:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
export type ResponsesCallOptions = {
  model: string;
  system: string;
  user: string | Array<{ role: "user" | "system"; content: string }>;
  temperature?: number;
  top_p?: number;
  response_format?:
    | { type: "json_object" }
    | { type: "json_schema"; json_schema: unknown };
};
```

```37:85:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
export async function responsesCall({ model, system, user, temperature, top_p, response_format }: ResponsesCallOptions) {
  const args: Record<string, unknown> = { model };
  const nonGen = isNonGenerative(model);
  if (!nonGen && typeof temperature === "number") args.temperature = temperature;
  if (!nonGen && typeof top_p === "number") args.top_p = top_p;
  if (typeof user === "string") {
    args.instructions = system;
    args.input = user;
  } else {
    args.input = [{ role: "system", content: system }, ...user];
  }
  if (!nonGen && response_format) args.response_format = response_format;
  try {
    return await openai.responses.create(args as any);
  } catch (e: unknown) {
    // Fallback: strip unsupported params (e.g., temperature on GPT‑5)
    const err = e as { error?: { message?: string } } | { message?: string };
    const msg = String((err as any)?.error?.message || (err as any)?.message || "");
    const unsupportedTemp = /Unsupported parameter:\s*'temperature'/i.test(msg);
    if (unsupportedTemp) {
      const retryArgs: Record<string, unknown> = { ...args };
      delete (retryArgs as any).temperature;
      delete (retryArgs as any).top_p;
      delete (retryArgs as any).response_format;
      if (process.env.NODE_ENV !== "production") {
        console.warn("[responsesCall:fallback:no-temperature]", { model });
      }
      return await openai.responses.create(retryArgs as any);
    }
    throw e;
  }
}
```

### Prompt engineering patterns

- Consistent system + user prompts with strict JSON outputs via `response_format: { type: "json_object" }`.
- JSON contract validation happens after parsing; some routes also set defaults for missing fields.
- Example (Notebook Prismatic):

```147:170:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
const system = [
  "You are a translation variant generator.",
  "Generate 3 distinct translation variants (A, B, C) for a single line of poetry.",
  "Variant A: More literal/close to source",
  "Variant B: Balanced (similar to current translation if provided)",
  "Variant C: More creative/natural",
  "Return STRICT JSON only:",
  '{ "variants": [{ "label": "A"|"B"|"C", "text": string, "rationale": string, "confidence": 0-1 }] }',
].join(" ");
...
completion = await openai.chat.completions.create({
  model: modelToUse,
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: system },
    { role: "user", content: userPrompt },
  ],
});
```

- Example (Guide Analyze Poem):

```84:93:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/guide/analyze-poem/route.ts
const system = [
  "You are a poetry analysis assistant.",
  "Return STRICT JSON only, no prose.",
  "Schema: { language: string, wordCount: number, summary: string, tone: string[], dialect?: string|null, themes: string[], keyImages: string[] }",
].join(" ");
```

### Token management and optimization

- No explicit token counting; optimizations used:
  - Caching idempotent results (`cacheGet`/`cacheSet`)
  - Rate limiting hot endpoints (daily limits stubbed via Redis helper)
  - Compact prompts; strict JSON outputs to reduce churn

```176:186:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
const cached = await cacheGet<AIAssistResponse>(cacheKey);
if (cached) {
  return NextResponse.json(cached);
}
...
await cacheSet(cacheKey, result, 3600);
```

```83:99:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
const rateCheck = await checkDailyLimit(user.id, `notebook:ai-assist:${threadId}`, 10 * 60);
if (!rateCheck.allowed) {
  return NextResponse.json({ error: "Rate limit exceeded", current: rateCheck.current, max: rateCheck.max }, { status: 429 });
}
```

### Streaming response handling

- Current routes use non-streaming `chat.completions.create` and `responses.create`. No streaming implemented.
- To add streaming, prefer Server-Sent Events or Web Streams in App Router with `ReadableStream` and `response_type: "stream"` (future work).

### Error handling for LLM failures

- Two layers:
  - Parameter fallback: remove unsupported params for GPT‑5 in `responsesCall`.
  - Model fallback: when model is missing/unsupported, switch to `gpt-4o` or `gpt-4o-mini`; otherwise return 502 with an error envelope.

```200:238:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
} catch (modelError: any) {
  const shouldFallback = modelError?.error?.code === "model_not_found" || modelError?.status === 404 || modelError?.status === 400;
  if (shouldFallback) { /* fallback to gpt-4o */ } else { return err(502, "OPENAI_FAIL", "Upstream prismatic generation failed.", { upstream: String(modelError?.message ?? modelError) }); }
}
```

```125:154:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/guide/analyze-poem/route.ts
} catch (modelError: any) {
  const shouldFallback = modelError?.error?.code === 'model_not_found' || modelError?.status === 404 || modelError?.status === 400;
  if (shouldFallback) { /* fallback to gpt-4o-mini */ } else { return err(502, "OPENAI_FAIL", "Upstream analysis failed.", { upstream: String(modelError?.message ?? modelError) }); }
}
```

- Moderation uses OpenAI Moderation API; returns flagged/categories only.

```8:20:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/moderation.ts
export async function moderateText(text: string) {
  const client = getOpenAI();
  const res = await client.moderations.create({ model: "omni-moderation-latest", input: text.slice(0, 20000) });
  const results = (res as any).results;
  const first = Array.isArray(results) ? results[0] : undefined;
  const flagged = !!first?.flagged;
  const categories: Record<string, unknown> = first?.categories ?? {};
  return { flagged, categories };
}
```

### Adding a new LLM provider (pattern)

- Create `src/lib/ai/{provider}.ts` exporting a singleton client and a `responsesCall`-like adapter that normalizes:
  - Inputs: `model`, `system`, `user`, sampling params, `response_format`
  - Outputs: text/JSON payload with consistent shape for downstream parsing
- Update routes to import the provider adapter or inject via a factory selected by env (`LLM_PROVIDER`).
- Ensure feature parity: JSON mode, model fallback strategy, and error envelopes with 5xx on upstream failures.

Minimal adapter interface:

```ts
export type LLMCallArgs = {
  model: string;
  system: string;
  user: string | Array<{ role: "user" | "system"; content: string }>;
  temperature?: number;
  top_p?: number;
  response_format?:
    | { type: "json_object" }
    | { type: "json_schema"; json_schema: unknown };
};
export type LLMCall = (args: LLMCallArgs) => Promise<{ content: string }>;
```

### Testing strategies

- Contract tests:
  - Zod-validate outputs for strict JSON routes (fail on structure mismatch)
  - Include defaults enforcement tests (e.g., fill optional arrays)
- Determinism:
  - Use lower temperature (0.0–0.2) for CI tests
  - Mock OpenAI client; assert adapter is called with expected args
- Offline tests:
  - Gate network via env; skip or mock when `OPENAI_API_KEY` is missing
- Example validation (seen in routes):

```201:211:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
let parsed;
try {
  parsed = JSON.parse(text);
} catch (parseError) {
  console.error("[ai-assist] Parse error:", parseError);
  return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 });
}
```

### Models and selection

- Defaults via env in `src/lib/models.ts` (translator/enhancer/router/embeddings)

```1:8:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-5";
export const ENHANCER_MODEL = process.env.ENHANCER_MODEL?.trim() || "gpt-5-mini";
export const ROUTER_MODEL = process.env.ROUTER_MODEL?.trim() || "gpt-5-nano-2025-08-07";
export const EMBEDDINGS_MODEL = process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-3-large";
```

### Summary

- Provider: OpenAI only today; responses + chat.completions + moderation
- Patterns: strict JSON prompts, Zod validation, caching + rate limits, model/param fallback
- Gaps: no streaming yet; no third-party monitoring; Anthropic/Gemini adapters not implemented
