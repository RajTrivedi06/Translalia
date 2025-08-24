# Flow API (dev smoke)

## Start

curl -X POST http://localhost:3000/api/flow/start \
 -H "Content-Type: application/json" \
 -d '{
"threadId": "<THREAD_UUID>",
"poem": "Salt wind \n broken oar"
}'

## Answer (advance one step)

curl -X POST http://localhost:3000/api/flow/answer \
 -H "Content-Type: application/json" \
 -d '{
"threadId": "<THREAD_UUID>",
"questionId": "q1_target",
"answer": "Moroccan Arabic, Casablanca urban register"
}'

## Peek (next question + phase)

GET /api/flow/peek?threadId=<THREAD_UUID>

- 200: { ok: true, phase, nextQuestion?: { id, prompt } | null, snapshot: { poem_excerpt, collected_fields } }
- 400: { error: "threadId required" }
- 404: { error: "Thread not found" }
- 500: { error: string } (e.g., missing column guidance)

## Confirm (move to translating)

curl -X POST http://localhost:3000/api/flow/confirm \
 -H "Content-Type: application/json" \
 -d '{
"threadId": "<THREAD_UUID>"
}'

- 200: { ok: true, phase: "translating" }
- 400: { error }
- 404: { error: "Thread not found" }
- 409: { error: "Not at plan gate" }
- 500: { error }

## Journey Activity (recent events)

GET /api/journey/list?projectId=<PROJECT_UUID>&limit=20

- Auth: supports Supabase auth cookies and `Authorization: Bearer <access_token>`.
- 200: `{ ok: true, items: [{ id, kind, summary, meta, created_at }] }`
- 400/500: `{ error }`

Notes:

- Items include `accept_line` per-line entries and a batch summary like “Accepted N line(s)”. The UI groups consecutive accepts from the same submit into one entry with a collapsible details section.
