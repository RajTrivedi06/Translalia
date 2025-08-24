## Business Logic

### Core business rules

- Threads capture conversation context and a JSON `state` that drives the translation workflow.
- Interview questions collect constraints; plan is confirmed before translation preview.

### Workflow processes

1. Start interview

```ts
// src/app/api/flow/start/route.ts
await patchThreadState(threadId, {
  phase: "interviewing",
  poem_excerpt: poem,
  collected_fields: {},
});
return NextResponse.json({
  ok: true,
  phase: "interviewing",
  nextQuestion: { id: q.id, prompt: q.prompt },
});
```

2. Answer questions → compute next

```ts
// src/app/api/flow/answer/route.ts
const updated = processAnswer(questionId as QuestionId, answer, state);
await patchThreadState(threadId, updated);
const nextQ = computeNextQuestion(updated);
```

3. Confirm plan

```ts
// src/app/api/flow/confirm/route.ts
await patchThreadState(threadId, { phase: "translating" });
```

4. Translator preview

```ts
// src/app/api/translator/preview/route.ts
const resp = await openai.chat.completions.create({ model, messages });
const preview = parseTranslatorOutput(resp.choices[0]?.message?.content ?? "");
```

5. Accept translated lines

```ts
// src/app/api/translator/accept-lines/route.ts
for (const s of selections) {
  await supabase.rpc("accept_line", {
    p_thread_id: threadId,
    p_line_index: s.index + 1,
    p_new_text: s.text,
    p_actor: userId,
  });
}
```

### Calculation algorithms

- `computeNextQuestion` determines progression through an ordered set of interview questions.
- `processAnswer` merges user answers into `state.collected_fields` with guardrails.
  Path: `src/server/flow/questions.ts`

### Data transformations

- `server/threadState.ts` deep-merges partial updates into `chat_threads.state` safely.

```ts
// src/server/threadState.ts
function deepMerge(base, patch) {
  /* shallow-for-objects deep merge */
}
```

### Business validations

- Moderation on preview and accept-lines to block unsafe content.

```ts
// src/app/api/translator/preview/route.ts
const pre = await moderateText(
  bundle.poem + "\n" + JSON.stringify(bundle.enhanced).slice(0, 4000)
);
if (pre.flagged)
  return NextResponse.json(
    { error: "Content flagged by moderation; cannot preview." },
    { status: 400 }
  );
```

- Zod schemas enforce payload shape for create/update endpoints (`lib/schemas.ts`).
