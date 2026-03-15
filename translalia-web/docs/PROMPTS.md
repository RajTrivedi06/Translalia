# Translalia Prompt System Map

## What this file is for
Maps active prompt families to their source files, routes, contracts, and flags.

## When to read/use this
- Read when tracing an LLM-backed feature from API route to prompt builder.
- Use this instead of pasting prompt bodies into new docs.
- Read `docs/05-llm/DOC_MAP.md` first for task routing.

## Prompt-family map

| Family | Source files | Main callers | Output contract | Flags / notes |
| --- | --- | --- | --- | --- |
| Method 2 line translation | `src/lib/ai/workshopPrompts.ts`, `src/lib/ai/simplifiedPrompts.ts`, `src/lib/ai/variantRecipes.ts`, `src/lib/ai/diversityGate.ts`, `src/lib/ai/regen.ts`, `src/lib/translation/method2/translateLineWithRecipesInternal.ts` | `/api/workshop/translate-line-with-recipes`, `/api/workshop/retry-line`, `src/lib/workshop/processStanza.ts`, `/api/notebook/prismatic` | LLM returns JSON `variants[{label,text}]`; app converts to `LineTranslationResponse` | `USE_SIMPLIFIED_PROMPTS=1` uses the simplified branch; `USE_SIMPLIFIED_PROMPTS=0` keeps the older archetype-heavy rollback path |
| Method 1 line translation | `src/lib/workshop/translateLineInternal.ts`, `src/lib/ai/workshopPrompts.ts`, `src/lib/ai/alignmentGenerator.ts` | `/api/workshop/translate-line` | Full `LineTranslationResponse` with word alignments | Legacy path; still routed when guide state selects `translationMethod="method-1"` |
| Notebook AI assist | `src/lib/ai/workshopPrompts.ts` | `/api/notebook/ai-assist` | `{ cellId, suggestion, confidence, reasoning?, alternatives? }` | Respects selected student words; uses masked prompt audits |
| Notebook suggestions, step 1-3 | `src/lib/ai/notebookSuggestionsPrompts.ts`, `src/types/notebookSuggestions.ts` | `/api/notebook/suggestions` | Step-specific JSON for `identify`, `adjust`, `personalize` | Uses `responsesCall`; cached per thread and step; rate-limited |
| Rhyme workshop | `src/lib/ai/rhymeWorkshopPrompts.ts`, `src/types/rhymeWorkshop.ts` | `/api/workshop/rhyme-workshop` | JSON with `rhymeWorkshop`, `soundWorkshop`, `rhythmWorkshop` arrays | Uses rhyme-dictionary and line-analysis context when available |
| Additional line suggestions | `src/lib/ai/suggestions/suggestionsPromptBuilders.ts`, `src/lib/ai/suggestions/suggestionsService.ts`, `src/lib/ai/suggestions/suggestionsSchemas.ts` | `/api/workshop/additional-suggestions` | `{ suggestions: [...] }` after schema + gate validation | Requires anchor tokens from draft or variants; includes repair pass when needed |
| Journey reflection / feedback | `src/lib/ai/workshopPrompts.ts`, `src/lib/ai/localePrompts.ts` | `/api/journey/generate-reflection`, `/api/journey/generate-brief-feedback` | Reflection JSON or short feedback text, then app-level validation/persistence | Locale-specific system prompts come from `localePrompts.ts` |
| Reflection Step C | `src/lib/ai/workshopPrompts.ts` | `/api/reflection/ai-assist-step-c` | `{ aims, suggestions[] }` | Context comes from completed translations and reflection notes |
| Verification / context notes | `src/lib/ai/verificationPrompts.ts` | `/api/verification/grade-line`, `/api/verification/context-notes` | Structured grading / note payloads | Prompt audits stored in `prompt_audits`; feature availability depends on verification flags |

## Method 2 translation prompt routing
- `translateLineWithRecipesInternal()` is the current core translation entrypoint.
- It always calls `getOrCreateVariantRecipes()` first.
- With `USE_SIMPLIFIED_PROMPTS=1`, recipe generation is bypassed in favor of static v6 recipes and simplified prompt instructions.
- With `USE_SIMPLIFIED_PROMPTS=0`, the older archetype/lens recipe path remains available for rollback.
- Regeneration and diversity checks still run in both modes; they switch wording based on the same flag.

## Contracts agents should preserve
- Translation prompts must keep machine-parseable JSON output with no prose wrapper.
- Prompt bodies are not the authority for response shapes; `zod` schemas and TypeScript types are.
- `prompt_audits` stores masked prompt material only. Do not introduce raw-secret or raw-user-data logging.
- GPT-5 branches intentionally omit unsupported sampling parameters; do not normalize them back in.

## Highest-signal files to open by task
- Translation output quality issue: `src/lib/translation/method2/translateLineWithRecipesInternal.ts`
- Prompt wording or mode behavior: `src/lib/ai/workshopPrompts.ts`, `src/lib/ai/simplifiedPrompts.ts`
- Recipe caching or rollback logic: `src/lib/ai/variantRecipes.ts`
- Regen or diversity failures: `src/lib/ai/diversityGate.ts`, `src/lib/ai/regen.ts`
- Notebook suggestion behavior: `src/app/api/notebook/suggestions/route.ts`, `src/lib/ai/notebookSuggestionsPrompts.ts`
- Workshop suggestion behavior: `src/app/api/workshop/additional-suggestions/route.ts`, `src/lib/ai/suggestions/`

## Do not duplicate in docs
- Full prompt text blocks
- Full JSON schemas already defined in code
- Model parameter lists already covered by `docs/02-reference/config-and-env.md`

## Next docs
- `TRANSLATION_PIPELINE.md` for the end-to-end workshop flow
- `docs/02-reference/api.md` for route coverage
- `docs/02-reference/config-and-env.md` for flags that change prompt behavior
