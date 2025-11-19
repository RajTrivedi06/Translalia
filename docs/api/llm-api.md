doc_purpose: "Document LLM usage across endpoints, models/params, errors, cost, and examples"
audiences: ["devs","ops","prompt-engineers","LLM"]
version: "2025-11-04"
last_scanned_code_at: "2025-11-04"
evidence_policy: "anchors-required"

### Summary

We use the OpenAI SDK. Current endpoints call `chat.completions.create` directly (JSON outputs where applicable) with model fallbacks; a `responses.create` helper also exists. Prompt hashing utilities are available for consistent logging; debug previews are gated by env.

### LLM-related endpoints (current)

- `/api/guide/analyze-poem` (POST) — poem analysis JSON
- `/api/journey/generate-reflection` (POST) — reflective journey summary JSON
- `/api/notebook/ai-assist` (POST) — suggestion JSON for selected words
- `/api/notebook/prismatic` (POST) — A/B/C variants JSON for a line
- `/api/workshop/generate-options` (POST) — per-word options JSON
- `/api/interview/next` (POST) — clarifying question JSON (feature off)

Common request keys: `model`, `temperature?`, `response_format?`, `messages` (system+user)

#### Models and parameters

```2:12:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-4o";
export const ENHANCER_MODEL =
  process.env.ENHANCER_MODEL?.trim() || "gpt-5-mini";
export const ROUTER_MODEL =
  process.env.ROUTER_MODEL?.trim() || "gpt-5-nano-2025-08-07";
export const EMBEDDINGS_MODEL =
  process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-3-large";
```

Parameters by surface:

- GPT‑5 family: omit `temperature`/`top_p`; set `response_format: { type: "json_object" }` for JSON surfaces
- GPT‑4/4o fallback: include `temperature` (0.2–0.7 by surface) and set `response_format: json_object`

Where used (anchors):

- Analyze Poem (ENHANCER_MODEL):

```100:123:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/guide/analyze-poem/route.ts
if (isGpt5) {
  completion = await openai.chat.completions.create({
    model: modelToUse,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
  });
} else {
  completion = await openai.chat.completions.create({
    model: modelToUse,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [ ... ],
  });
}
```

- Journey Reflection (ENHANCER_MODEL):

```162:180:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/generate-reflection/route.ts
if (isGpt5) { /* json_object */ } else { /* temperature: 0.7 + json_object */ }
```

- Prismatic (TRANSLATOR_MODEL):

```181:201:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
if (isGpt5) { /* json_object */ } else { /* temperature: 0.7 + json_object */ }
```

- AI Assist (TRANSLATOR_MODEL):

```146:168:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
if (isGpt5) { /* response_format json_object; no temperature */ } else { /* temperature: 0.7 */ }
```

- Workshop Options (TRANSLATOR_MODEL):

```156:177:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/workshop/generate-options/route.ts
if (isGpt5) { /* json_object */ } else { /* temperature: 0.7 */ }
```

- Interview Clarifier (ROUTER_MODEL):

```31:52:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/interview/next/route.ts
completion = await openai.chat.completions.create({ model: modelToUse, temperature: 0.2, response_format: { type: "json_object" }, messages: [...] });
```

### Helpers, hashing, and debug

- OpenAI client and helper with retry for unsupported parameters:

```38:61:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
export async function responsesCall({ model, system, user, temperature, top_p, response_format }: ResponsesCallOptions) {
  const args: Record<string, unknown> = { model };
  const nonGen = isNonGenerative(model);
  if (!nonGen && typeof temperature === "number") args.temperature = temperature;
  if (!nonGen && typeof top_p === "number") args.top_p = top_p;
  if (typeof user === "string") { args.instructions = system; args.input = user; }
  else { args.input = [{ role: "system", content: system }, ...user]; }
  if (!nonGen && response_format) args.response_format = response_format;
  return await openai.responses.create(args as any);
}
```

```68:83:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
const unsupportedTemp = /Unsupported parameter:\s*'temperature'/i.test(msg);
if (unsupportedTemp) { /* drop temperature/top_p/response_format and retry */ }
```

- Prompt hashing and debug gating:

```11:20:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/promptHash.ts
export function buildPromptHash(args: { route: string; model: string; system: string; user: string; schema?: string; }) {
  const { route, model, system, user, schema } = args;
  return stableHash({ route, model, system, user, schema });
}
```

```30:43:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/promptHash.ts
const DEBUG = process.env.DEBUG_PROMPTS === "1" || process.env.NEXT_PUBLIC_DEBUG_PROMPTS === "1";
if (!DEBUG) return;
// Avoid printing full poem/user content in logs
console.info("[LLM]", { route: args.route, model: args.model, hash: args.hash, systemPreview: squeeze(args.system), userPreview: squeeze(args.user, 300) });
```

### Token usage, cost, caching

- Tokens roughly scale with prompt size (system + user blobs). JSON outputs tend to be shorter and cheaper than free‑form prose.
- Cache keys are stable SHA‑256 of input bundles with prefixes; default TTL 3600s; eviction on TTL expiry.

```23:29:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/cache.ts
export async function cacheSet<T>(key: string, value: T, ttlSec = 3600): Promise<void> {
  mem.set(key, { expires: Date.now() + ttlSec * 1000, value });
}
```

- Quotas: Redis helper is stubbed to always allow in this snapshot; add actual limits when enabling Redis.

### Error handling and retries

- Endpoint fallbacks on model errors (404/400):

```182:201:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/generate-reflection/route.ts
const shouldFallback = modelError?.error?.code === "model_not_found" || modelError?.status === 404 || modelError?.status === 400;
if (shouldFallback) { modelToUse = "gpt-4o-mini"; completion = await openai.chat.completions.create({ ... }); }
```

- Helper-level retry removes unsupported parameters (see helper above).

### Streaming

- Not used in this snapshot. All endpoints return a single JSON response per request.

### Example requests

Analyze poem (JSON):

```http
POST /api/guide/analyze-poem
Content-Type: application/json
{ "poem": "...", "threadId": "uuid" }
```

Notebook prismatic (JSON):

```http
POST /api/notebook/prismatic
Content-Type: application/json
{ "threadId": "uuid", "lineIndex": 0, "sourceText": "..." }
```

Workshop generate options (JSON):

```http
POST /api/workshop/generate-options
Content-Type: application/json
{ "threadId": "uuid", "lineIndex": 0, "lineText": "..." }
```
