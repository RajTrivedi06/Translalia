# LLM API smoke

# Build plan

curl -X POST http://localhost:3000/api/enhancer \
 -H "Content-Type: application/json" \
 -d '{"threadId":"<THREAD_UUID>"}'

# Translate

curl -X POST http://localhost:3000/api/translate \
 -H "Content-Type: application/json" \
 -d '{"threadId":"<THREAD_UUID>"}'
