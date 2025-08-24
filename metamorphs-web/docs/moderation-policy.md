# Moderation Policy (Phase 0)

- Preview: show results without moderation gate.
- Persist (accept/save): run moderation on input and output. If violations, block save with a friendly message and keep the draft in memory only.
- Enhancer: check poem excerpt prior to LLM call; return `{ error: "Poem content flagged by moderation; cannot enhance." }` with 400 if flagged.
- Translator accept-lines: enforce moderation before persisting accepted content; return `{ error }` and do not mutate DB when flagged.
