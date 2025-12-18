# Translation Method Usage Analysis

## Summary

**Both methods are used**, but the application **prefers line-level translation** when context is available, and **falls back to word-by-word** when context is missing or line translation fails.

---

## Decision Flow in WordGrid Component

**File**: `src/components/workshop-rail/WordGrid.tsx:273-368`

### Step 1: Check for Existing Line Translation

```typescript
// Line 258-260
const hasLineTranslation =
  selectedLineIndex !== null &&
  lineTranslations[selectedLineIndex] !== undefined;
```

**If line translation exists**: ✅ Use it (don't fetch again)

---

### Step 2: Check for Cached Word Options

```typescript
// Line 263-264
const cachedWordOptions =
  selectedLineIndex !== null ? wordOptionsCache[selectedLineIndex] : null;
```

**If cached word options exist**: ✅ Restore and use them (don't fetch again)

---

### Step 3: Try Line Translation First (If Context Available)

```typescript
// Line 298-345
if (lineContext) {
  translateLine({
    threadId: thread,
    lineIndex: selectedLineIndex,
    lineText,
    fullPoem: lineContext.fullPoem,      // ✅ Full poem context
    stanzaIndex: lineContext.stanzaIndex, // ✅ Stanza context
    prevLine: lineContext.prevLine,       // ✅ Previous line
    nextLine: lineContext.nextLine,       // ✅ Next line
  });

  // On error: Fall back to word-by-word
  onError: () => {
    generateOptions({ ... }); // Fallback
  }
}
```

**Condition**: `lineContext` must be available (has `prevLine`, `nextLine`, `fullPoem`, `stanzaIndex`)

**API Used**: `/api/workshop/translate-line` (line-level translation)

**Prompt Used**: `buildLineTranslationPrompt()` - includes full poem, surrounding lines

---

### Step 4: Fall Back to Word-by-Word (If No Context or Line Translation Fails)

```typescript
// Line 346-367
else {
  // No context available, use old workflow
  generateOptions({
    threadId: thread,
    lineIndex: selectedLineIndex,
    lineText, // ❌ Only current line, no context
  });
}
```

**Condition**: `lineContext` is `null` OR line translation failed

**API Used**: `/api/workshop/generate-options` (word-by-word)

**Prompt Used**: `buildWordTranslationPrompt()` - only current line, no surrounding context

---

## UI Rendering Logic

**File**: `src/components/workshop-rail/WordGrid.tsx:436-484`

### Priority 1: Line-Level Translation UI (Preferred)

```typescript
// Line 437-483
if (currentLineTranslation) {
  return (
    <div>
      {/* Shows 3 full-line translation variants */}
      {currentLineTranslation.translations.map((variant) => (
        <TranslationVariantCard
          variant={variant}  // Full line with word alignment
          isSelected={...}
          onSelect={...}
        />
      ))}
    </div>
  );
}
```

**What User Sees**:

- 3 complete translated lines (variants 1, 2, 3)
- Each variant shows aligned words (original → translation)
- User selects entire line variant
- Can drag individual tokens from variants

**Data Structure**:

```typescript
{
  translations: [
    {
      variant: 1,
      fullText: "complete translated line",
      words: [
        { original: "The", translation: "El", position: 0 },
        { original: "star", translation: "astro", position: 1 },
        // ... word-level alignment
      ],
      metadata: { literalness: 0.8, ... }
    },
    // ... variants 2 and 3
  ]
}
```

---

### Priority 2: Word-by-Word UI (Fallback)

```typescript
// Line 486-600
// Fall back to old word-by-word UI
if (!wordOptions) {
  return <LoadingState />;
}

return (
  <div>
    {/* Horizontal word-by-word translation layout */}
    {wordOptions.map((w) => (
      <WordColumn
        word={w}  // { original, position, options: [opt1, opt2, opt3] }
        onSelectOption={...}
      />
    ))}
  </div>
);
```

**What User Sees**:

- Horizontal grid of words
- Each word column shows 3 options (A, B, C)
- User selects option per word individually
- Builds line word-by-word

**Data Structure**:

```typescript
{
  words: [
    {
      original: "star",
      position: 0,
      options: ["estrella", "astro", "lucero"], // 3 options
      partOfSpeech: "noun",
    },
    // ... one per word
  ];
}
```

---

## When Each Method is Used

### Line-Level Translation Used When:

1. ✅ `lineContext` is available (has `prevLine`, `nextLine`, `fullPoem`, `stanzaIndex`)
2. ✅ Line translation API call succeeds
3. ✅ `currentLineTranslation` exists in store

**Typical Scenario**: User selects a line in a stanza with full poem context

---

### Word-by-Word Translation Used When:

1. ❌ `lineContext` is `null` (no surrounding context available)
2. ❌ Line translation API call fails (falls back)
3. ❌ Cached word options exist (from previous session)

**Typical Scenario**:

- First line of poem (no previous line)
- Last line of poem (no next line)
- Context not loaded yet
- Line translation failed

---

## Current State Analysis

### Based on Code Review:

**Line-Level Translation**:

- ✅ **Preferred method** when context available
- ✅ Uses richer prompt (`buildLineTranslationPrompt`) with full poem
- ✅ Includes surrounding lines for better context
- ✅ Provides word-level alignment within full-line variants
- ❌ **Requires `lineContext`** - may not always be available

**Word-by-Word Translation**:

- ✅ **Fallback method** when context missing
- ✅ Still actively used (not deprecated)
- ❌ Uses minimal prompt (`buildWordTranslationPrompt`) - only current line
- ❌ **No surrounding context** - this is the issue from investigation
- ❌ **This is what the investigation focused on** (Issue #13)

---

## Critical Finding for Issue #13

**The investigation focused on `buildWordTranslationPrompt()` (word-by-word)**, but:

1. **Line-level translation is preferred** and uses a different, richer prompt
2. **Word-by-word is still used** as fallback (when context missing or line translation fails)
3. **Both prompts need improvement** for translation zone enforcement

**Recommendation**:

- Fix `buildWordTranslationPrompt()` (word-by-word) - **HIGH PRIORITY** (still used as fallback)
- Also review `buildLineTranslationPrompt()` (line-level) - **MEDIUM PRIORITY** (preferred method)

---

## Usage Statistics (Estimated)

Based on code flow:

| Scenario                | Method Used  | Frequency                     |
| ----------------------- | ------------ | ----------------------------- |
| Line with full context  | Line-level   | ~70% (when context available) |
| First/Last line         | Word-by-word | ~15% (no prev/next line)      |
| Line translation failed | Word-by-word | ~10% (fallback)               |
| Cached word options     | Word-by-word | ~5% (from previous session)   |

**Note**: These are estimates. Actual usage depends on:

- How often `lineContext` is available
- Success rate of line translation API
- User behavior (selecting first/last lines)

---

## Code Locations

### Line-Level Translation

- **API**: `src/app/api/workshop/translate-line/route.ts`
- **Prompt**: `src/lib/ai/workshopPrompts.ts:437-565` (`buildLineTranslationPrompt`)
- **Hook**: `src/lib/hooks/useTranslateLine.ts`
- **UI**: `src/components/workshop-rail/WordGrid.tsx:437-483`

### Word-by-Word Translation

- **API**: `src/app/api/workshop/generate-options/route.ts`
- **Prompt**: `src/lib/ai/workshopPrompts.ts:143-183` (`buildWordTranslationPrompt`)
- **Hook**: `src/lib/hooks/useWorkshopFlow.ts` (`useGenerateOptions`)
- **UI**: `src/components/workshop-rail/WordGrid.tsx:486-600`

---

## Answer to User's Question

**Q: Are we using Word-level options or Line-Level options?**

**A: Both are used, with this priority:**

1. **Line-Level** (preferred) - Used when `lineContext` is available

   - Shows 3 full-line translation variants
   - User selects entire line
   - Includes word-level alignment within variants

2. **Word-by-Word** (fallback) - Used when:
   - No `lineContext` available
   - Line translation fails
   - Cached word options exist
   - Shows 3 options per word
   - User builds line word-by-word

**The investigation report focused on word-by-word prompts** because:

- They're still actively used (fallback)
- They have the weakest prompt (no surrounding context)
- They're what users see when context is missing

**Both methods need prompt improvements**, but word-by-word is the **immediate priority** since it's the one with the weakest implementation.
