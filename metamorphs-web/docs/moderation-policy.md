# Moderation Policy (Phase 0)

- Preview: show results without moderation gate.
- Persist (accept/save): run moderation on input and output. If violations, block save with a friendly message and keep the draft in memory only.
- Enhancer: check poem excerpt prior to LLM call; return `{ error: "Poem content flagged by moderation; cannot enhance." }` with 400 if flagged.
- Translator accept-lines: enforce moderation before persisting accepted content; return `{ error }` and do not mutate DB when flagged.

## Implementation Details

- API: `lib/ai/moderation.ts` wraps OpenAI moderations with `model: "omni-moderation-latest"` and returns `{ flagged, categories }`.
- Enhancer and Translate call moderation pre/post as appropriate; accept-lines moderates the combined selected text prior to RPC writes.

## Escalation & Review (future)

- If flagged, provide user-facing guidance and a way to request review.
- Admin review tools can be added to list flagged items and override decisions (not implemented).

## Filtering Patterns

- Perform moderation before writes; allow previews to display with warnings where policy allows.
- Avoid storing flagged content; keep in-memory only.

## User Reporting & Appeals (future)

- Add endpoints for users to report content and to request appeal of blocks.

## Compliance & Legal

- Do not store raw LLM prompts/outputs beyond operational necessity; log only usage metrics and hashed inputs when possible.

## Metrics & Monitoring

- Track counts of moderated blocks, categories, and endpoint-level rates.
- Surface 4xx/5xx rates and latency; consider adding structured logs for moderation outcomes.

## Moderation Checklist (LLM)

- Use `moderateText` before persistence and for enhancer inputs.
- Return 400 with clear messages on flagged content; avoid ambiguous failures.
- Do not log raw sensitive text; mask or hash where possible.
