# CJK Segmentation Recon

**Date:** 2026-08-09
**Scope:** Read-only reconnaissance. Where does Translalia assume whitespace-delimited words?
**Status:** Findings only — no recommendations, no code changes.

All paths are relative to `translalia-web/`.

---

## Vocabulary used below

Three distinct tokenizers exist and behave differently on CJK. Naming them once:

| Name | Location | Normalization before split | CJK behaviour |
|---|---|---|---|
| `tokenize` (diversity) | `src/lib/ai/diversityGate.ts:171` | lowercase, `[^\p{L}\p{N}\s] → " "` | `\p{L}` **matches Han/Kana**, so CJK chars survive; CJK punctuation (`、。，`) becomes a separator. A line with no internal punctuation → **1 token**. |
| `tokenize` (textNormalize) | `src/lib/ai/textNormalize.ts:63` | via `normalizeForContainment` — `[^\p{L}\p{N}'\s-] → " "` | Same as above: CJK punctuation separates, otherwise **1 token per punctuation-free run**. |
| `tokenizeLight` | `src/lib/ai/structureSignature.ts:101` | lowercase, collapse whitespace, split, **then** strip leading/trailing non-`\p{L}\p{N}'` | Punctuation is *not* a separator (only trimmed at edges), so an entire CJK line → **1 token** even with internal `、`. |

A fourth pattern — bare `text.replace(/[^\w\s]/g, "")` in the diversity gate's short-line patch — uses ASCII-only `\w` and **deletes every CJK character**, leaving an empty string. This matters (see §4).

---

## 1. Tokenization sites

CJK-safe? = does this produce a sensible result for a Chinese/Japanese line with no spaces?

| file:line | tokenizes what | consumer | CJK-safe? |
|---|---|---|---|
| `src/components/workshop-rail/WordGrid.tsx:392` | source poem line (raw user input) | **UI** — "Source text words" chips | ❌ 1 chip for the whole line |
| `src/components/workshop-rail/WordGrid.tsx:1238` | `variant.fullText` (fallback when `words[]` empty) | **UI** — draggable variant chips | ❌ 1 chip for the whole variant |
| `src/lib/ai/diversityGate.ts:171` (`tokenize`) | variant text | **Gate** — Jaccard sets in `checkDistinctness` | ❌ set of ≤ a few tokens; Jaccard degenerates to exact match |
| `src/lib/ai/diversityGate.ts:189` (`tokenizeList`) | variant text | **Gate** — content-token counts, opener/bigram checks | ❌ count ≈ 1 → always "short line" branch |
| `src/lib/ai/diversityGate.ts:641,735` (`replace(/[^\w\s]/g,"")`) | variant text, for trigram similarity | **Gate** — short-line char-similarity patch | ❌ ASCII `\w` deletes all CJK → compares empty strings |
| `src/lib/ai/diversityGate.ts:1205` | variant text | **Gate (advisory)** — `checkLensCompliance` fragment-length heuristic | ❌ word count ≈ 1, never flags |
| `src/lib/ai/fidelityGate.ts:113` | variant/source text | **Gate** — `extractProperNouns` | ❌ 1 token; also Latin-only capitalization regex |
| `src/lib/ai/structureSignature.ts:105` (`tokenizeLight`) | variant text | **Gate** — opener type, length bucket, signature | ❌ 1 token → `openerType` always `OTHER`, bucket always `short` |
| `src/lib/ai/textNormalize.ts:65` (`tokenize`) | anchor realizations, suggestion words, arbitrary text | **Gate + API validation** (`anchorsValidation`, `suggestionsGate`, `token-suggestions` route) | ❌ coarse; stopword tests meaningless for CJK |
| `src/lib/ai/scorecard.ts:66` | variant text | **Telemetry** — `cAvoidsI` first-token pronoun check | ❌ first "token" is the whole line |
| `src/lib/ai/scorecard.ts:133-140` | A/B/C texts | **Telemetry** — content-overlap scores | ❌ same degeneracy as the gate |
| `src/lib/translation/method2/detectSubjectForm.ts:37` | Variant C text | **Gate input** — locally computed `c_subject_form_used` | ❌ splits on `[^a-z']+` → **zero tokens**, returns `null`, falls back to model self-report |
| `src/lib/translation/method2/computeAnchorRealizations.ts:39,47,88,89` | variant text + `concept_en` | **Gate** — Phase 1 anchor realizations | ❌ word-boundary walk expands across the whole line |
| `src/lib/ai/suggestions/suggestionsPromptBuilders.ts:26` | variant/draft text | **Prompt** — `extractSnippet` (first N tokens as example) | ❌ snippet = entire line |
| `src/lib/ai/suggestions/suggestionsPromptBuilders.ts:140` | current line, to mark focused token | **Prompt** — `markTokenInText(text, position)` wraps token *n* in `[[ ]]` | ❌ position 0 marks the entire line |
| `src/lib/ai/suggestions/suggestionsGate.ts:168` | model-returned suggestion string | **Gate** — max-3-words rule | ⚠️ a whole CJK clause counts as 1 word → passes silently |
| `src/lib/ai/suggestions/suggestionsGate.ts:96` (`englishLeakageScore`) | suggestion string | **Gate** — English-leakage rejection | ⚠️ no CJK stopword set exists; `pickStopwords` falls back to English |
| `src/lib/ai/alignmentGenerator.ts:110,111,140,141` | source + translated text | **Persistence** — fallback positional alignment | ❌ 1:1 map of one giant token |
| `scripts/translation-worker.ts:~165` | source + translated text | **Persistence** — alignment error fallback | ❌ same |
| `src/lib/ai/poemSuggestions.ts:26` | poem lines | **Prompt** — last-word extraction for rhyme hints | ❌ last "word" = whole line |
| `src/lib/rhyme/rhymeService.ts:170` | poem lines | **Feature** — line-ending rhyme lookup (Datamuse, English-only API) | ❌ |
| `src/lib/rhyme/soundAnalysis.ts:114,207,237,255,351,412,497` | line text | **Feature** — syllables, stress, alliteration | ❌ English orthography heuristics throughout |
| `src/components/notebook/ComparisonView.tsx:1335-1336` | source + translation | **UI** — "difference indicator" word-count delta | ❌ always reports 0-word difference |
| `src/app/api/journey/generate-brief-feedback/route.ts:232` | LLM feedback prose (not user text) | **Validation** — 50-word floor | ✅ n/a (feedback is in the UI language) |
| `src/lib/poem/stanzaDetection.ts:37` | poem text | **Structure** — stanza split on blank lines | ✅ line/stanza level only, no word assumption |
| `src/lib/ai/stopwords.ts:701` (`pickStopwords`) | language *hint* string | **Gate** — stopword set selection | ❌ patterns cover en/fr/es/de/pt/it only; anything else → `EN_STOPWORDS` |

**No `Intl.Segmenter` anywhere in the repo.** No `\b\w+\b` / `/\w+/g` word-extraction regexes outside the diversity-gate patch noted above.

---

## 2. Workshop UI path

### Variant chips — `TranslationVariantCard` (`src/components/workshop-rail/WordGrid.tsx:1221-1345`)

Token derivation (`WordGrid.tsx:1233-1246`):

```
if (variant.words.length > 0) return variant.words;
return variant.fullText.split(/\s+/).filter(Boolean)
  .map((word, idx) => ({ original: word, translation: word,
                         partOfSpeech: "neutral", position: idx }));
```

- It **does** read `translations[*].words` — that is the first branch.
- When `words[]` is empty (always, under Method 2 — see §6) it whitespace-splits `fullText`. In the fallback, `original === translation` (the chip shows the target-language word and claims it as its own source word), and `partOfSpeech` is `"neutral"` for every chip, which is why all chips render in the same POS colour.
- For Chinese this yields exactly one chip containing the whole line. That is the "single unsegmented block" symptom.
- `handleAddAllTokens` (`:1249`) rejoins tokens with `" "`, so clicking the card body inserts space-joined text into the draft. With one token this is lossless; with real CJK segmentation it would insert spaces that do not belong.

### "Source text words" panel — `SourceWordsPalette` (`WordGrid.tsx:1155-1203`)

Fed by `sourceWords` (`WordGrid.tsx:387-393`):

```
const line = poemLines[currentLineIndex];
return line.split(/\s+/).filter(Boolean);
```

- Derived client-side from the raw poem line only. It **never** reads `translations[*].words` and never calls the server. The comment on `:386` states this is deliberate ("instant, no LLM wait").
- Chinese line → array of length 1 → one full-width chip.
- If the array is empty the panel returns `null` (renders nothing).

### The "N chars" badge

`WordGrid.tsx:1338-1340`:

```
<Badge variant="outline" className="text-xs">
  {variant.metadata.characterCount} chars
</Badge>
```

- **Unconditional.** There is no words-vs-chars branch anywhere; the badge always says "chars". (The only other `characterCount` UI is `GuideRail.tsx:922`, an unrelated poem-length-vs-limit pill.)
- Value origin: Method 2 sets it to `finalVariants[i].text.length` (`translateLineWithRecipesInternal.ts:1161,1170,1179`). Method 1 takes the model's self-reported `characterCount`, falling back to `fullText.length` (`translateLineInternal.ts:337-339`). Both are JS `String.length` — UTF-16 code units, so most CJK counts 1 per char but characters outside the BMP (rare Han extensions, emoji) count 2.

---

## 3. Word-level interactions

### Right-click / long-press → `/api/workshop/token-suggestions`

Two entry points, same payload shape:

- Source chip: `DraggableSourceWord` `onContextMenu` (`WordGrid.tsx:211-221`) and 450 ms long-press (`:189-204`) → `{ word, originalWord: word, partOfSpeech: "neutral", position: index, sourceType: "source" }`.
- Variant chip: `DraggableVariantToken` `onContextMenu` (`WordGrid.tsx:1457-1468`) → `{ word: token.translation, originalWord: token.original || token.translation, partOfSpeech, position: token.position ?? 0, sourceType: "variant", variantId }`.

Both flow through `handleOpenTokenSuggestions` → `generateTokenSuggestions` → POST (`WordGrid.tsx:738-770`).

**What identifies a "word" in the payload:** both a **string** (`focus.word`) and an **integer token index** (`focus.position`), validated by `TokenSuggestionsRequestSchema` (`src/lib/ai/suggestions/suggestionsSchemas.ts:88-95`). `position` is `z.number().int().min(0).optional().nullable()`. **There are no character offsets anywhere.**

Server-side consumption:
- `src/app/api/workshop/token-suggestions/route.ts` — passes `focus` through to the prompt builder; also runs `hasAnyTokens` / `hasTargetLanguageAnchors` (`:63-88`) using `textNormalize.tokenize`, which for a CJK line returns ≥1 token, so these guards pass.
- `markTokenInText` (`suggestionsPromptBuilders.ts:138-146`) re-splits the line by `/\s+/` and wraps token `position` in `[[…]]`. **The index is re-resolved server-side against a whitespace split.** Any client-side segmentation that is not whitespace-based silently desynchronizes from this index — the marker would land on the wrong span or be dropped (`position >= tokens.length` returns the text unmarked).
- `runSuggestionsGate` (`suggestionsGate.ts`) rejects suggestions of >3 whitespace-words, dedupes against an anchor-token set built with `textNormalize.tokenize`, and scores English leakage against `pickStopwords(targetLanguage)` — which for any non-en/fr/es/de/pt/it hint is the English set.

### Drag a source word to keep it

`DraggableSourceWord` builds `DragData` (`WordGrid.tsx:145-153`): `{ id: "source-<line>-<index>", text: word, originalWord: word, sourceLineNumber, position: index, dragType: "sourceWord", partOfSpeech: "neutral" }` — again string + index, no offsets. Drop/click both call `appendToDraft(targetLine, dragData.text)`.

`appendToDraft` (`src/store/workshopSlice.ts:157-167`) joins with a literal space when the draft is non-empty:

```
const separator = current.trim() ? " " : "";
draftLines[lineIndex] = current + separator + text;
```

**What breaks if a token were multi-character with no surrounding whitespace:**
1. Every appended token gets a space in front of it — a Chinese draft assembled chip-by-chip would come out as `词 词 词`.
2. `focus.position` computed client-side under a non-whitespace segmentation does not match `markTokenInText`'s server-side whitespace split (above).
3. `DraggableVariantToken`'s React `key` is `` `${variant}-${token.position}-${idx}` `` and the dnd-kit id embeds `token.translation` (`WordGrid.tsx:1380`); repeated identical CJK tokens in one line would collide on `position` if positions were not unique.
4. `save-line` (below) keys variant-to-variant option lookup on `position` equality across variants — position parity across differently-segmented variants is not guaranteed.

`src/app/api/workshop/save-line/route.ts:92-116` maps `selectedVariant.words` into `selections` and `word_options` for the verification feature, matching options across variants by `w.position`. With `words[]` empty these arrays are empty, so verification receives no word-level data at all today.

---

## 4. Gates

### `checkDistinctness` — `src/lib/ai/diversityGate.ts:305-887`

Order of operations and the CJK consequence for a line that whitespace-splits to one token:

1. **Empty-text safety check** (`:328-336`). Unaffected.
2. **Structural signature block** (`:341-431`), via `structuralSignature(text, targetLanguage)`.
   - `tokenizeLight` returns 1 token (the whole line). `openerType` compares that token against Latin-script pronoun/preposition/determiner lexicons (`structureSignature.ts:16-47`) → no match → **`OTHER` for all three variants**.
   - `lengthBucket` = `short` (count 1 ≤ 6) for all three.
   - `punctuationProfile` counts only ASCII `, - : ;` — CJK `，、。` are not counted → **`c0d0k0s0` for all three**.
   - `tenseAspectApprox` returns `UNKNOWN` for any non-`en` hint, and the hint is usually not `en` anyway.
   - Net: **all three variants produce the identical signature `OTHER|short|c0d0k0s0|UNKNOWN`**.
   - **Adventurous mode:** Rule 1 (`:358`) fires immediately — `signature_match_c`. Guaranteed failure on every Chinese line.
   - **Balanced mode:** the all-openers-equal check (`:410-430`) fires — `opener_all_same`. Guaranteed failure on every Chinese line.
   - **Focused mode:** no structural check; falls through.
3. **Legacy shape checks** (`:492-630`) are guarded by `minLen >= MIN_TOKENS_FOR_TEMPLATE_CHECK` (6). `minLen` is 1, so subject-opener, opening-bigram, comparison-marker and walk-verb checks are **all skipped**.
4. **Short-line patch** (`:637-770`), entered whenever `avgContentTokenCount <= 6` — always true for CJK.
   - Check 1 (trigram char similarity) computes `variants[i].text.toLowerCase().replace(/[^\w\s]/g, "")`. `\w` here is ASCII-only (no `u` flag, no `\p{}`), so **every CJK character is deleted**; both operands become `""`, `getTrigrams("")` is empty, `union.size === 0` → `charSimilarity = 0`. Never fires.
   - Check 2 (opening substring) operates on the same emptied strings; `opening.length >= 10` is false → never fires.
   - Check 3 (diversity lever) counts `[,;:\-—]` on the *original* text — CJK punctuation is not in that class → both 0 → `hasStructuralDifference` false; but the similarity it then measures is again the emptied-string 0, which is not `> 0.70` → never fires.
   - **The entire short-line patch is a no-op for CJK.**
5. **Length-aware Jaccard** (`:776`). Token sets have ~1 element each, so `jaccardSimilarity` is effectively a **binary exact-match test**: 1.0 for byte-identical variants, 0.0 otherwise. Thresholds at `contentTokenCount = 1`: adventurous `1.0`, focused `0.75` (or `1.0` under `USE_SIMPLIFIED_PROMPTS=1`), balanced `0.80` (or `0.90` simplified). Since the comparison is strict `>`, **adventurous and simplified-focused cannot fail here even on literally identical variants**.

**Net behaviour for Chinese:** balanced and adventurous fail the gate deterministically at the signature/opener stage on *every* line, regardless of how different the variants actually are; focused passes essentially unconditionally. Downstream (`translateLineWithRecipesInternal.ts:892-1010`) that failure triggers exactly one regeneration round (`MAX_REGEN_ROUNDS` default 1), the recheck fails again for the same structural reason, the code logs `Recheck after regen still failed` and continues anyway, and the line is stamped `quality_tier: "salvage"` (`:1027-1046`). So: one wasted regen call per line plus a permanently misleading quality tier.

Nuance: a Chinese line *containing* `，` or `、` splits into >1 token under `tokenize`/`tokenizeList` (those are `\p{L}`-complement and become separators) but still 1 token under `tokenizeLight` (which only trims edges). So the Jaccard/threshold path can see 2-3 tokens while the signature path still sees 1 — the two tokenizers disagree on the same text.

### `checkFidelity` — `src/lib/ai/fidelityGate.ts:281-348`

Four independent checks, computed on the *source* then asserted against each variant:

- **Numbers** (`:30-58`, `:151-195`): `\b\d{1,4}\b`, `\d+%`, `[$€£¥]\d+`, `\d+\.\d+`. Matching is by ASCII digit substring, with a final `variantText.includes(sourceDigits)` fallback. Fully number-agnostic to script, **but** blind to CJK numerals (一二三…, 〇, 万) and to full-width digits (０-９), so a source "1923" rendered as "一九二三" reports `Missing numbers: 1923` and fails.
- **Negation** (`:63-106`, `:200-217`): a fixed list of en/fr/es/it regexes with `\b` boundaries. **No CJK entries.** A Chinese source containing 不/没有/未 yields `sourceHasNegation = false`, so the check is skipped entirely — silently unenforced rather than wrongly enforced. Conversely a Chinese *variant* of a negated English source will contain no listed marker → `Source has negation but variant does not` → hard fail.
- **Proper nouns** (`:111-132`): `text.split(/\s+/)`, skip index 0, strip non-`\p{L}`, then test `^[A-Z…][a-z…]*$` — a Latin-only capitalization pattern; plus `\b[A-Z]{2,}\b` for acronyms. For a CJK source this extracts **nothing** (no uppercase/lowercase distinction), so the check is inert. For a CJK *variant* of a Latin source, the check requires the Latin proper noun to appear verbatim (case-insensitive `includes`) in the variant — a transliterated name (Paris → 巴黎) fails with `Missing proper nouns`.
- **Terminal intent** (`:137-146`): `endsWith("?")` / `endsWith("!")` on the trimmed text. Does not recognize full-width `？` `！`, so a Chinese question rendered with `？` reads as `none` on the source side (check skipped) or as a mismatch on the variant side if the source used ASCII `?`.

`checkFidelity` fails the whole line on the *first* failing variant and returns that variant's index.

### `detectSubjectForm` — `src/lib/translation/method2/detectSubjectForm.ts:28-105`

`const tokens = t.toLowerCase().trim().split(/[^a-z']+/).filter(Boolean)` — the separator class is the complement of ASCII `a-z`, so **a pure-CJK string splits into nothing**: `tokens.length === 0` → early `return null` at `:39-41`.

Consumer (`translateLineWithRecipesInternal.ts:559-585`): when local detection returns `null`, the code falls back to the model-provided `c_subject_form_used`. Validation (`anchorsValidation.ts:402-460`) then requires that field to be present, to be one of the allowed values, to not be `"i"` in balanced/adventurous, and to match the recipe's `stance_plan.subject_form` — all judged on the model's unverifiable self-report. So for CJK targets the local hardening added by ISS-014 silently disables itself and Phase 1 becomes trust-the-model. If the model omits the field, Phase 1 fails with `c_subject_form_used missing or not a string`.

Also note: even for a *mixed* string, any Latin substring survives the split, so a CJK line containing e.g. "I" as a loanword would be classified from that fragment.

### `computeAnchorRealizations` — `src/lib/translation/method2/computeAnchorRealizations.ts:29-169`

- `:39` `variantText.split(/\s+/)` → 1 word for CJK (this array is only used for the ±2-word expansion window).
- `:45-48` splits `anchor.concept_en` on whitespace and filters English stopwords. `concept_en` is by construction English.
- `:64-69` searches for each English keyword with `variantLower.indexOf(term)`. **Against a Chinese variant this never matches**, so it falls through to `anchor.source_tokens` (`:51-53`) — which are source-language tokens, matching only when source and target scripts coincide.
- `:74-83` the word-boundary walk (`while (/\S/.test(...))`) expands outward until it hits whitespace. In a space-free CJK line this **expands to the entire line** in both directions, so `start`/`end` are 0 and `text.length`; the resulting candidate is then usually discarded by the `candidate.length <= 50` cap at `:127`.
- `:88-89` `beforeText.trim().split(/\s+/)` — for an empty `beforeText` this yields `[""]`, i.e. length 1 rather than 0, so the expansion loop can index a phantom word.
- Net: for a CJK target the function returns `{}` (or near-empty). Consequence depends on a flag: with `ENABLE_LOCAL_ANCHOR_REALIZATIONS=1` (`translateLineWithRecipesInternal.ts:703`), `validateAnchorRealizations` skips the missing-keys check and validates only the keys present (`anchorsValidation.ts:219-232`) → **vacuous pass, zero anchor coverage, no signal**. With the flag off (the default), the model's own realizations are validated instead, and `containsNormalized` (whose normalization is `\p{L}`-aware) works acceptably for CJK.
- `compareRealizations` (`:179-244`) hardcodes `pickStopwords("en")` at `:205` for its stopword-only telemetry counters.

---

## 5. Language signal

**`sourceLanguage`** — every consumer reads `state.poem_analysis.language`:
`translate-line/route.ts:207`, `translate-line-with-recipes/route.ts:126`, `retry-line/route.ts:140`, `token-suggestions/route.ts:231`, `line-suggestions/route.ts:171`, `additional-suggestions/route.ts:133`, `runTranslationTick.ts:202`; verification routes read `poem_analysis.detected_language` (`grade-line/route.ts:208`, `context-notes/route.ts:220`).

A repo-wide grep finds **only reads of `poem_analysis` — no writer anywhere in `src/`**. Every call site therefore falls back to its default literal, i.e. `sourceLanguage === "the source language"` (or `"unknown"` in `grade-line`). **The source language signal is, in current code, a constant placeholder string.**

**`targetLanguage`** — resolved in `translate-line-with-recipes/route.ts:127-131` from `guideAnswers.targetLanguage.{lang,variety}`, else `"the target language"`. That field is declared in `src/store/guideSlice.ts:56` as `targetLanguage?: { lang: string; variety: string; script: string }` under a comment reading *"Legacy structured fields are kept optional so previously saved projects keep loading without errors. New flows won't populate these."* A grep across `src/store/guideSlice.ts`, `src/components/guide/`, and `src/lib/hooks/useGuideFlow.ts` finds **no setter** — the current guide flow collects free-form `translationIntent` / `translationZone` / `sourceLanguageVariety` text instead. So for new threads `targetLanguage` is also `"the target language"`.

There **is** a `script` field in that legacy type. Nothing reads it.

Downstream effect of the placeholder:
- `pickStopwords("the target language")` (`src/lib/ai/stopwords.ts:701-745`) matches none of the `LANGUAGE_PATTERNS` (en/fr/es/de/pt/it) and no BCP-47 prefix → returns `EN_STOPWORDS`. Content-token counts, anchor stopword checks, and suggestion leakage scoring all run against English stopwords regardless of the real target.
- `structureSignature.detectLanguage()` (`:65-77`) likewise defaults to `"en"`, selecting English pronoun/preposition/determiner lexicons and enabling the English-only gerund and tense heuristics.
- `WordGrid.tsx:289-294` builds `resolvedTargetLanguage` from the same empty store field → `"the target language"`, sends it as `targetLanguage` in the token-suggestions payload; the route detects it as a placeholder (`isPlaceholderTargetLanguage`, `token-suggestions/route.ts:27-31`), tries `getGuideTargetLanguage(guideAnswers)`, and when that is also empty **hardcodes `"English"`** (`:233-235`). The same fallback exists in `line-suggestions/route.ts:173-175`.

**Existing script/language detection in the repo:** essentially none.
- `detectLanguage(langHint)` in `structureSignature.ts:65` and `pickStopwords` in `stopwords.ts:701` are *hint string matchers*, not detectors, and cover six Latin-script European languages.
- The only Unicode-script test anywhere is `DEVANAGARI_REGEX = /[ऀ-ॿ]/` in `src/lib/ai/suggestions/suggestionsGate.ts:40`, used to count non-Latin-script suggestions.
- No CJK code-block regex, no `Intl.Segmenter`, no `franc`/`cld`-style dependency.

---

## 6. Alignment

**`words[]` is never populated in the live Method 2 path.**

- `src/lib/translation/method2/translateLineWithRecipesInternal.ts:1074-1090`: the `enqueueAlignmentJob({...})` call is **commented out**, immediately below a comment reading *"Alignment is optional for Method 2 … For now, we skip alignment for Method 2 to reduce latency."* The next line hardcodes `const alignments: AlignedWord[][] = [[], [], []]`, and `:1158,1167,1176` assign those empty arrays into each variant's `words`. Early-return error paths (`:130,136,142`) also emit `words: []`.
- `enqueueAlignmentJob` (`src/lib/workshop/alignmentQueue.ts:31`) has **no live caller** — the only reference is the commented block above.
- `scripts/translation-worker.ts` still imports `AlignmentJob`, the queue helpers, and `generateAlignmentsBatched`, and defines `processAlignmentJob` (`:118-185`) which calls `updateLineAlignment` (`src/lib/workshop/jobState.ts:621`). This code is intact and runnable (`npm run worker:translations`), but since nothing enqueues, the alignment queue is permanently empty. Its error fallback at `:165-172` does a positional whitespace word-to-word map.
- `src/lib/ai/alignmentGenerator.ts` is therefore reachable **only** from that dormant worker path. Its own fallback (`:110-111,140-141`) is likewise `trim().split(/\s+/)` positional zipping. `generateAlignmentsParallel` (`:312`) is explicitly `@deprecated`.
- **Method 1** (`src/lib/workshop/translateLineInternal.ts:318-331`) *does* populate `words[]` — it maps the model's own `words` array straight out of the JSON response, defaulting `position` to array index. Method 1 is reachable: `useTranslateLine.ts:33` reads `answers.translationMethod ?? "method-2"` and `:57` routes `method-2` to `/translate-line-with-recipes`, anything else to `/translate-line`. The prompt for it (`src/lib/ai/workshopPrompts.ts:611-760`) asks the model for per-word alignment, and its own few-shot examples show variants 2 and 3 with `"words": []`.

So: `words[]` is populated only when a thread is explicitly on `method-1` *and* the model returns a non-empty `words` array. In every default (`method-2`) thread it is `[]`, which is exactly the condition that sends `TranslationVariantCard` into its `fullText.split(/\s+/)` fallback.

---

## Open questions

1. **Who was supposed to write `poem_analysis`?** No writer exists in `src/`. Whether it is written by an out-of-band job, an older migration, a Supabase trigger, or was simply never implemented could not be determined from the code. Existing threads in the DB may or may not carry the field — I did not query the database.
2. **Is `method-1` reachable in the current UI?** The routing branch exists and `translation_method` is a real column, but I found no UI control that sets `answers.translationMethod` to `"method-1"`. It may be DB-only / legacy-thread-only.
3. **Is `scripts/translation-worker.ts` deployed and running anywhere?** It is wired to `npm run worker:translations` and still processes the *translation* queue; only its alignment half is orphaned. Deployment topology is not visible from the repo.
4. **What are the effective values of `USE_SIMPLIFIED_PROMPTS`, `ENABLE_LOCAL_ANCHOR_REALIZATIONS`, `MAX_REGEN_ROUNDS`, and `ALLOW_STOPWORD_ONLY_ANCHORS` in production?** Several CJK conclusions in §4 flip between "vacuous pass" and "hard fail" depending on these; I did not read any `.env`.
5. **Does the model actually emit `c_subject_form_used` for CJK targets?** With local detection returning `null`, Phase 1 depends entirely on that self-report. Determining the real failure rate needs logs, not code.
6. **Are there live threads with CJK source text today?** The Workshop symptom is reported, but I could not confirm from code whether `sourceLanguageVariety` / `translationIntent` free-text is being used to name Chinese, or whether the model is inferring it from the poem alone.
7. **`characterCount` and astral-plane characters** — `String.length` is UTF-16 code units. Whether the "N chars" badge is expected to count grapheme clusters is a product question, not answerable from code.
