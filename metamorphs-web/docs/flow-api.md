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
