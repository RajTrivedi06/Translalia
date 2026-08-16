# CJK work — side-channel handoff

Systemic problems noticed in passing during the CJK segmentation work. Logged,
not investigated, not fixed. One line each.

- `translalia-web/package.json:9` — no `test` script and `vitest` is not in `devDependencies`, yet `src/lib/workshop/runTranslationTick.test.ts:10`, `src/lib/workshop/__tests__/stuckChunkRecovery.test.ts:8` and `src/app/api/workshop/translate-line-with-recipes/deepseekGate.test.ts:7` all `import { describe, it, expect } from "vitest"` — the entire test suite is unrunnable as committed.
- `translalia-web/tsconfig.json:31` — `exclude` lists `**/*.test.ts` and `**/__tests__/**`, so `npm run typecheck` never type-checks any test file; a test can reference a deleted export and stay green.
- `translalia-web/src/lib/ai/suggestions/suggestionsPromptBuilders.ts:9` — `MIN_EXAMPLE_TOKENS` is assigned and never used (the only ESLint warning in the suggestions or text modules).
- `docs/application-investigation/2026-08-09/` — appeared as untracked during this session from outside this task; not created or touched here, flagged only so it is not mistaken for CJK output.
- `translalia-web/src/lib/ai/suggestions/suggestionsPromptBuilders.ts:312` — `buildTokenSuggestionsPrompt` marks the focused span in `targetLineDraft`, but a `sourceType: "variant"` focus originates from the variant's `fullText`, a different string; the index path has always had this mismatch and offsets inherit it. Worked around client-side in `WordGrid.tsx` (`offsetsForTarget`) rather than fixed, since the fix belongs server-side.
- `translalia-web/src/components/workshop-rail/WordGrid.tsx:158` — `getSuggestionErrorMessage` is defined and never called, so token-suggestion failures surface raw reason codes instead of the friendly strings that function exists to produce.
- `translalia-web/src/lib/translation/method2/translateLineWithRecipesInternal.ts:667` — confirms ledger F-01-009 and goes further: the `FIDELITY_GATE_BLOCKING === "1"` if-body is empty, and `fidelityResult` is read only by two `console.log` calls, so the fidelity gate cannot block, set a quality tier, or trigger regen under ANY env configuration — setting the flag in production would change nothing.
