# LLM API smoke

# Build plan (Enhancer)

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

# Translate

curl -X POST http://localhost:3000/api/translate \
 -H "Content-Type: application/json" \
 -d '{"threadId":"<THREAD_UUID>"}'

- 200: { ok: true, result: { versionA, notes[], blocked } }
- 400/404/409/500: { error }
