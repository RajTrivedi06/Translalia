# LLM API

## Endpoints Overview

- Enhancer (plan builder): `POST /api/enhancer` (flag: `NEXT_PUBLIC_FEATURE_ENHANCER=1`)
- Translator (preview node): `POST /api/translator/preview` (flag: `NEXT_PUBLIC_FEATURE_TRANSLATOR=1`)
- Translator (instructional generation): `POST /api/translator/instruct` (flag: `NEXT_PUBLIC_FEATURE_TRANSLATOR=1`)
- Translator (legacy single-shot): `POST /api/translate` (flag: `NEXT_PUBLIC_FEATURE_TRANSLATOR=1`)

Auth: Supabase cookie and/or `Authorization: Bearer <access_token>` as documented in API routes.

Rate limiting: Preview endpoint only (30/min per threadId).

---

## Enhancer (Plan Builder)

- Endpoint: `POST /api/enhancer`
- Body: `{ "threadId": string(uuid) }`
- Feature flag: `NEXT_PUBLIC_FEATURE_ENHANCER=1`
- Model selection: `process.env.ENHANCER_MODEL || "gpt-4o-mini"`
- Prompt template (system):

```ts
"You are the Prompt Enhancer for Metamorphs, a decolonial poetry-translation workspace.\n" +
  "INPUTS provided:\n- POEM_EXCERPT: verbatim text (preserve spacing/line breaks).\n- COLLECTED_FIELDS: JSON of user choices.\n" +
  "TASK: Produce a human-readable plan and a structured enhanced request.\n" +
  "Return a SINGLE JSON object named ENHANCER_PAYLOAD with keys:\nplain_english_summary, poem_excerpt (echo verbatim), enhanced_request, warnings[].\n" +
  "Rules: keep decolonial stance, preserve excerpt exactly, list any defaults as _assumptions inside enhanced_request.\n" +
  "Never return anything outside ENHANCER_PAYLOAD.";
```

- Response format: `{ ok: true, plan: EnhancerPayload, usage? }`
- Validation: `EnhancerPayloadSchema` (Zod); response_format: `{ type: "json_object" }`
- Errors: 400 (validation/moderation), 403 (feature disabled), 404 (thread not found), 500 (non-JSON or parse)
- Caching: `enhancer:` + `stableHash({ poem, fields })`, TTL 3600s

Example:

```bash
curl -X POST http://localhost:3000/api/enhancer \
  -H "Content-Type: application/json" \
  -d '{"threadId":"<THREAD_UUID>"}'
```

---

## Translator – Preview (Node)

- Endpoint: `POST /api/translator/preview`
- Body: `{ "threadId": string(uuid) }`
- Feature flag: `NEXT_PUBLIC_FEATURE_TRANSLATOR=1`
- Rate limit: 30 req/min per thread
- Model selection: `process.env.TRANSLATOR_MODEL || "gpt-4o"`
- Prompt template (system): `TRANSLATOR_SYSTEM` in `lib/ai/prompts.ts`

```ts
export const TRANSLATOR_SYSTEM = `You are a decolonial poetry translator.\nPriorities: ...\nYou MUST output using these exact markers:\n---VERSION A---\n<poem lines>\n---NOTES---\n- bullet 1\n- bullet 2`;
```

- Request assembly: uses server `buildTranslateBundle(threadId)` to collect poem, enhanced request, line policy, accepted lines, ledger notes, and summary
- Behavior: creates placeholder version (status:"placeholder"), calls LLM, parses output, updates `versions.meta` with `status:"generated"` and `overview:{ lines[], notes[] }`
- Response: `{ ok, versionId, displayLabel, preview: { lines[], notes[], line_policy }, cached? }`
- Validation: `parseTranslatorOutput(raw)` and Zod schema
- Errors: 400 (validation/moderation), 401 (auth), 403 (feature disabled), 409 (state), 429 (rate limit), 500 (update failure), 502 (parse)
- Caching: `translator_preview:` + `stableHash(bundle)`, TTL 3600s

---

## Translator – Instruct (Directed Generation)

- Endpoint: `POST /api/translator/instruct`
- Body: `{ "threadId": uuid, "instruction": string, "citeVersionId"?: uuid }`
- Feature flag: `NEXT_PUBLIC_FEATURE_TRANSLATOR=1`
- Model selection: `process.env.TRANSLATOR_MODEL || "gpt-4o"`
- Behavior: allocates a display label; inserts placeholder version with `meta.thread_id`, `meta.display_label`, optional `meta.parent_version_id`; includes cited version text if provided; updates to `status:"generated"` with `overview`
- Response: `{ ok: true, versionId, displayLabel }`
- Errors: 400 (validation), 401 (auth), 403 (feature disabled), 404 (thread/version not found), 500 (update failure or parse)

---

## Translator – Legacy Single Shot

- Endpoint: `POST /api/translate`
- Body: `{ "threadId": uuid }`
- Feature flag: `NEXT_PUBLIC_FEATURE_TRANSLATOR=1`
- Model selection: `process.env.TRANSLATOR_MODEL || "gpt-4o"`
- Parsing: inline split on markers and `TranslatorOutputSchema.safeParse`
- Response: `{ ok: true, result: { versionA: string, notes: string[], blocked: boolean }, usage? }`
- Errors: 400 (validation/moderation), 403 (feature disabled), 404 (thread), 409 (state), 502 (LLM output invalid)

```bash
curl -X POST http://localhost:3000/api/translate \
  -H "Content-Type: application/json" \
  -d '{"threadId":"<THREAD_UUID>"}'
```

---

## Model Selection and Fallback

- Defaults:
  - Enhancer: `ENHANCER_MODEL` env or `gpt-4o-mini`
  - Translator: `TRANSLATOR_MODEL` env or `gpt-4o`
  - Embeddings: `EMBEDDINGS_MODEL` env or `text-embedding-3-large`
- No automatic failover is implemented. To switch models, set env vars and redeploy.

---

## Rate Limiting and Quotas

- Preview endpoint uses an in-memory token bucket (`lib/ai/ratelimit.ts`) keyed by `preview:${threadId}` with window 60s and limit 30.
- No global per-user/hour quota is enforced in code; add an external gateway or extend rate limiter if needed.

---

## Cost and Optimization

- The OpenAI client returns `usage` tokens; responses include `usage` where available.
- Optimization patterns:
  - Cache identical preview/enhancer calls by a stable hash of inputs for 1 hour.
  - Trim poem and JSON bundle to essential context before calling LLMs.
  - Use lower-cost models for enhancer planning (`gpt-4o-mini`).

---

## Error Handling Patterns

- 400: Zod validation failures (return `.flatten()`), moderation blocks
- 401: unauthenticated
- 403: feature disabled
- 404: thread/version not found
- 409: invalid flow state (e.g., translating not ready)
- 429: rate limit exceeded (preview)
- 500: internal errors (e.g., non-JSON from enhancer)
- 502: LLM output malformed/unparseable

---

## Response Parsing and Validation

- Enhancer: `response_format: { type: "json_object" }` and `EnhancerPayloadSchema.parse()`
- Translator (preview/instruct): `parseTranslatorOutput(raw)` → lines + notes (Zod-validated)
- Translator (legacy): marker split + `TranslatorOutputSchema.safeParse`

---

## Debugging and Monitoring

- `GET /api/debug/whoami` reveals cookie names, bearer presence, and current uid for auth debugging.
- Translator preview returns `debug` bundle: counts of poem chars, accepted lines, ledger count, and summary chars.
- Log important steps to `journey_items` for traceability (e.g., accept-lines, compares, plan confirmed).

---

## LLM Integration Best Practices

- Always validate model outputs with Zod before persisting.
- Use cache and rate limit to reduce cost and improve UX.
- Keep prompts deterministic; use explicit markers and JSON `response_format` when possible.
- Separate orchestration (route handlers) from logic (server modules) for testability.

Don't Do:

- Don't persist unvalidated LLM outputs.
- Don't bypass auth guards for write operations.
- Don't depend on implicit model behavior; specify strict output formats.
