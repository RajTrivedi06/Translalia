# LLM API smoke

## Build plan (Enhancer)

Feature flag: set `NEXT_PUBLIC_FEATURE_ENHANCER=1` to enable.

curl -X POST http://localhost:3000/api/enhancer \
 -H "Content-Type: application/json" \
 -d '{"threadId":"<THREAD_UUID>"}'

- 200: { ok: true, plan, usage?, cached? }
- 400: { error } (validation; moderation)
- 403: Feature disabled
- 404: { error: "Thread not found" }
- 409: { error: "No poem excerpt in state" }
- 500: { error }

## Translator (legacy single-shot)

## Translator — Preview (Phase 2)

POST /api/translator/preview

- Body: `{ threadId }`
- Returns: `{ ok, versionId, displayLabel, preview }`
- Notes: creates placeholder node then updates `meta.overview`; fails loudly if RLS blocks update.

## Translator — Instruct (Phase 4)

POST /api/translator/instruct

- Body: `{ threadId, instruction, citeVersionId? }`
- Returns: `{ ok, versionId, displayLabel }`
- Notes: allocates label, sets `parent_version_id`, uses cited version full text when provided.

curl -X POST http://localhost:3000/api/translate \
 -H "Content-Type: application/json" \
 -d '{"threadId":"<THREAD_UUID>"}'

- 200: { ok: true, result: { versionA, notes[], blocked } }
- 400/404/409/500: { error }
