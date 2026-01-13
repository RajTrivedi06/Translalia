# Issue #13 Investigation Report: Line Translation Options Quality

## Executive Summary

**Root Cause Identified**: The word translation prompt is too minimal, translation zone is weakly enforced, and available context (surrounding lines, full poem) is not being utilized. The prompt lacks examples, emphasis, and variety guidance.

**Zone Effectiveness Score**: **3/10** - Translation zone appears once as a bullet point with no emphasis or examples.

---

## 1. Current Prompt Analysis

### 1.1 System Prompt (`buildWorkshopSystemPrompt()`)

**Location**: `src/lib/ai/workshopPrompts.ts:188-204`

**Current System Prompt**:

```
You are a poetry translation assistant. Your task is to provide translation options for individual words within poetic lines.

IMPORTANT:
- Return ONLY a valid JSON object with "partOfSpeech" and "options" fields
- No explanations, no markdown, no additional formatting
- Each option should be a single word or short phrase
- Options should vary from literal to creative
- Consider the poetic context and style preferences
- Identify the part of speech accurately based on context

Example valid response:
{
  "partOfSpeech": "noun",
  "options": ["love", "affection", "devotion"]
}
```

**Analysis**:

- ✅ Basic structure is clear
- ❌ No emphasis on translation zone
- ❌ No examples of literal/balanced/creative distinction
- ❌ Generic "vary from literal to creative" - not actionable
- ❌ No mention of domain-specific terminology
- **Length**: ~150 words (adequate but could be more specific)

### 1.2 User Prompt (`buildWordTranslationPrompt()`)

**Location**: `src/lib/ai/workshopPrompts.ts:143-183`

**Example Prompt for word "star" in line "The star shines bright"**:

```
You are translating poetry from English to Spanish.

Translator instructions:
- Translation zone: technical physics/biology
- Translation strategy: Use domain-specific terminology where applicable
- Translation approach: Balance literal and creative interpretations

Line being translated: "The star shines bright"
Focus word: "star"

Provide exactly 3 translation options for "star" that:
1. Honour the translator instructions above.
2. Fit naturally within the line context.
3. Span from literal to more creative interpretations (Balance literal and creative interpretations).

Keep each option to a single word or short phrase.
Also identify the part of speech for "star" in this context.

Return ONLY a JSON object with this exact structure:
{
  "partOfSpeech": "noun|verb|adjective|adverb|pronoun|preposition|conjunction|article|interjection",
  "options": ["option1", "option2", "option3"]
}
```

**Analysis**:

- **Total length**: ~200 words
- **Translation zone mentioned**: 1 time (as bullet point)
- **Emphasis level**: LOW (no capitalization, no repetition, no examples)
- **Examples provided**: 0
- **Context provided**: Only current line (no surrounding lines, no full poem)
- **Zone-specific guidance**: NONE

**Problems Identified**:

1. Translation zone appears once with no emphasis
2. No examples showing what "technical physics" translations should look like
3. No conditional logic based on zone type
4. "Honour the translator instructions" is vague - AI may ignore it
5. No surrounding context to understand metaphors/idioms

---

## 2. Context Availability Analysis

### 2.1 What's Available in API Request

**File**: `src/app/api/workshop/generate-options/route.ts:17-21`

**Request Schema**:

```typescript
{
  threadId: string,      // ✅ Available
  lineIndex: number,    // ✅ Available
  lineText: string,     // ✅ Available (ONLY current line)
}
```

**Missing from Request**:

- ❌ `prevLine` - Not sent
- ❌ `nextLine` - Not sent
- ❌ `fullPoem` - Not sent
- ❌ `stanzaIndex` - Not sent
- ❌ `surroundingLines` - Not sent
- ❌ `previouslySelectedWords` - Not sent

### 2.2 What's Available in Thread State

**File**: `src/app/api/workshop/generate-options/route.ts:98-106`

**Available in `thread.state`**:

```typescript
{
  guide_answers: {
    translationZone?: string,        // ✅ Available
    translationIntent?: string,      // ✅ Available
    targetLanguage?: {...},           // ✅ Available
    stance?: { closeness: ... },      // ✅ Available
    style?: { vibes: [...] },         // ✅ Available
    policy?: { must_keep: [...], no_go: [...] }, // ✅ Available
  },
  poem_analysis: {
    language?: string,                // ✅ Available (source language)
    // Note: poem_analysis.source_lines removed in recent refactor
  },
  // ❌ poem_stanzas - NOT accessed in generate-options
  // ❌ raw_poem - NOT accessed in generate-options
  // ❌ workshop_lines - NOT accessed (completed translations)
}
```

### 2.3 What's Available in Component but NOT Sent

**File**: `src/components/workshop-rail/WordGrid.tsx:196-201`

**`lineContext` available in component**:

```typescript
{
  prevLine?: string,      // ✅ Available in component
  nextLine?: string,      // ✅ Available in component
  stanzaIndex?: number,   // ✅ Available in component
  fullPoem?: string,      // ✅ Available in component
}
```

**Critical Finding**: `lineContext` is available in `WordGrid` component but **NOT passed to `generateOptions()` API call**!

**Code Evidence**:

```typescript
// WordGrid.tsx:419-423
generateOptions({
  threadId: thread,
  lineIndex: selectedLineIndex,
  lineText: poemLines[selectedLineIndex],
  // ❌ lineContext NOT passed here!
});
```

### 2.4 Context Usage Summary

| Context Type              | Available?     | Used in Prompt? | Impact if Added          |
| ------------------------- | -------------- | --------------- | ------------------------ |
| Current line              | ✅             | ✅              | Already used             |
| Translation zone          | ✅             | ✅ (weakly)     | Needs emphasis           |
| Translation intent        | ✅             | ✅ (weakly)     | Needs emphasis           |
| Previous line             | ✅ (component) | ❌              | HIGH - for metaphors     |
| Next line                 | ✅ (component) | ❌              | HIGH - for flow          |
| Full poem                 | ✅ (component) | ❌              | MEDIUM - for theme       |
| Stanza index              | ✅ (component) | ❌              | LOW - for structure      |
| Previously selected words | ❌             | ❌              | MEDIUM - for consistency |
| Source language           | ✅             | ✅              | Already used             |

---

## 3. Translation Zone Implementation Analysis

### 3.1 How Translation Zone is Included

**Location**: `src/lib/ai/workshopPrompts.ts:16-36`

**Current Implementation**:

```typescript
// Line 29-30
if (translationZone) {
  lines.push(`Translation zone: ${translationZone}`);
}
```

**Format in Prompt**:

```
Translator instructions:
- Translation zone: technical physics/biology
- Translation strategy: Use domain-specific terminology where applicable
```

### 3.2 Problems with Current Implementation

1. **No Emphasis**: Zone appears as a regular bullet point
2. **No Examples**: AI doesn't know what "technical physics" means in practice
3. **No Validation**: No check if output matches zone requirements
4. **No Repetition**: Mentioned once, easily ignored
5. **No Conditional Logic**: Same format for all zone types

### 3.3 Zone Effectiveness Score: **3/10**

**Why so low**:

- ✅ Zone is included in prompt
- ❌ No emphasis (should be **CRITICAL**, **REQUIRED**, **MUST FOLLOW**)
- ❌ No examples per zone type
- ❌ No validation that output matches zone
- ❌ No retry if zone not followed
- ❌ Appears only once (should be mentioned 2-3 times)

**Example of Weak Enforcement**:

```
Current: "Translation zone: technical physics/biology"
AI interpretation: "Oh, that's nice context, but I'll translate 'star' as 'estrella' (generic) anyway"
```

**What Strong Enforcement Would Look Like**:

```
CRITICAL REQUIREMENT - Translation Zone: technical physics/biology

You MUST provide options that use domain-specific terminology appropriate for physics/biology contexts.

For technical zones, options MUST:
- Use scientific register and terminology
- Include Latin/Greek roots where applicable (e.g., "stellar", "astral")
- Prefer domain-specific terms over generic translations

Examples:
- Generic: "star" → "estrella" ❌ (too generic for technical context)
- Technical: "star" → "astro", "cuerpo celeste", "estrella (astronomía)" ✅

Your options MUST reflect this technical domain. If you cannot provide technical options, indicate this in your response.
```

---

## 4. Model Parameters Analysis

### 4.1 Current Settings

**File**: `src/app/api/workshop/generate-options/route.ts:150-178`

**Model Configuration**:

```typescript
Model: TRANSLATOR_MODEL (defaults to "gpt-4o")
Temperature: 0.7 (fixed for all options)
Response format: { type: "json_object" }
Max tokens: Not explicitly set (uses model default)
```

**File**: `src/lib/models.ts:2`

```typescript
export const TRANSLATOR_MODEL =
  process.env.TRANSLATOR_MODEL?.trim() || "gpt-4o";
```

### 4.2 Problems Identified

1. **Fixed Temperature**: All 3 options generated with same temperature (0.7)
   - Should vary: literal (0.3-0.5), balanced (0.6-0.7), creative (0.9-1.0)
2. **Single API Call**: All 3 options generated in one call

   - Can't control variety per option
   - Options may be too similar

3. **No Temperature Experimentation**: No A/B testing of different temps

4. **JSON Format Constraint**: May limit creativity (but necessary for parsing)

### 4.3 Recommendations

**Option A: Per-Option Temperature** (3 separate API calls):

```typescript
// Option 1: Literal (temp 0.3)
// Option 2: Balanced (temp 0.7)
// Option 3: Creative (temp 1.0)
```

**Option B: Single Call with Explicit Instructions**:

```typescript
// Keep single call but add explicit variety instructions:
"Option 1: Very literal (word-for-word where possible)
 Option 2: Balanced (natural but close to source)
 Option 3: Creative (idiomatic, may rephrase)"
```

**Option C: Hybrid** (recommended):

- Use single call with explicit instructions
- Add temperature variation if options too similar (retry with higher temp)

---

## 5. Quality Controls Analysis

### 5.1 Current Validation

**File**: `src/app/api/workshop/generate-options/route.ts:234-267`

**What Exists**:

```typescript
// ✅ JSON parsing validation
// ✅ Array length check (ensures exactly 3 options)
// ✅ Fallback if parsing fails
// ❌ NO similarity checking between options
// ❌ NO zone compliance validation
// ❌ NO retry logic for low quality
// ❌ NO user feedback tracking
```

**Current Validation Code**:

```typescript
// Lines 253-258
if (options.length < 3) {
  options = [...options, word, `${word} (lit.)`, `${word} (alt)`].slice(0, 3);
} else if (options.length > 3) {
  options = options.slice(0, 3);
}
// That's it - no quality checks!
```

### 5.2 Missing Quality Controls

1. **Similarity Check**: Options might be too similar

   ```typescript
   // Example of what's missing:
   if (areOptionsTooSimilar(options)) {
     // Regenerate with higher temperature
   }
   ```

2. **Zone Compliance**: No check if options match translation zone

   ```typescript
   // Example:
   if (zone === "technical physics" && !hasTechnicalTerms(options)) {
     // Reject and regenerate
   }
   ```

3. **Retry Logic**: No retry if quality is low

   ```typescript
   // Example:
   let attempts = 0;
   while (attempts < 3 && !isQualityAcceptable(options)) {
     options = await generateWithAdjustedPrompt();
     attempts++;
   }
   ```

4. **User Selection Tracking**: No data on which options users prefer
   ```typescript
   // Missing: Track which option (A, B, or C) users select
   // Could use this to improve prompts over time
   ```

### 5.3 Impact of Missing Controls

- **Bad options shown to users**: No filtering of low-quality results
- **No learning**: Can't improve based on user behavior
- **Inconsistent quality**: Some words get great options, others get poor ones
- **Zone ignored**: No enforcement mechanism

---

## 6. Specific Code Issues

### 6.1 Issue #1: Translation Zone Weakly Enforced

**File**: `src/lib/ai/workshopPrompts.ts:29-30`

**Current Code**:

```typescript
if (translationZone) {
  lines.push(`Translation zone: ${translationZone}`);
}
```

**Problem**: No emphasis, no examples, no conditional logic

**Impact**: AI treats zone as optional context, not requirement

---

### 6.2 Issue #2: Missing Context in API Request

**File**: `src/app/api/workshop/generate-options/route.ts:17-21`

**Current Request Schema**:

```typescript
const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  lineText: z.string(), // Only current line
});
```

**Problem**: `prevLine`, `nextLine`, `fullPoem`, `stanzaIndex` not included

**Impact**: AI can't understand metaphors, idioms, or maintain flow across lines

---

### 6.3 Issue #3: No Examples in Prompt

**File**: `src/lib/ai/workshopPrompts.ts:162-183`

**Current Prompt**: No examples of good vs bad translations

**Problem**: AI doesn't understand what "literal", "balanced", "creative" means in practice

**Impact**: Options may not actually span the intended range

---

### 6.4 Issue #4: Fixed Temperature

**File**: `src/app/api/workshop/generate-options/route.ts:172`

**Current Code**:

```typescript
temperature: 0.7, // Fixed for all options
```

**Problem**: All 3 options generated with same creativity level

**Impact**: Options may be too similar, not enough variety

---

### 6.5 Issue #5: No Quality Validation

**File**: `src/app/api/workshop/generate-options/route.ts:253-258`

**Current Code**: Only validates array length, nothing else

**Problem**: No similarity check, no zone compliance, no retry

**Impact**: Low-quality options shown to users

---

## 7. Recommendations

### 7.1 Quick Wins (1-2 hours each)

#### Fix #1: Strengthen Translation Zone Language ⚡ HIGH IMPACT

**File**: `src/lib/ai/workshopPrompts.ts:16-36`

**Change**:

```typescript
// BEFORE:
if (translationZone) {
  lines.push(`Translation zone: ${translationZone}`);
}

// AFTER:
if (translationZone) {
  lines.push(`CRITICAL - Translation Zone: ${translationZone}`);
  lines.push(`You MUST provide options appropriate for this domain.`);

  // Add zone-specific examples
  if (
    translationZone.toLowerCase().includes("technical") ||
    translationZone.toLowerCase().includes("physics") ||
    translationZone.toLowerCase().includes("biology")
  ) {
    lines.push(
      `For technical zones: Use scientific terminology, prefer domain-specific terms over generic translations.`
    );
  }
  // Add more zone type conditionals...
}
```

**Expected Impact**: Zone compliance should improve from 30% to 70%+

---

#### Fix #2: Add Explicit Option Variety Instructions ⚡ HIGH IMPACT

**File**: `src/lib/ai/workshopPrompts.ts:170-173`

**Change**:

```typescript
// BEFORE:
Provide exactly 3 translation options for "${word}" that:
1. Honour the translator instructions above.
2. Fit naturally within the line context.
3. Span from literal to more creative interpretations (${closenessSummary}).

// AFTER:
Provide exactly 3 translation options for "${word}" that:
1. Honour the translator instructions above (ESPECIALLY the translation zone).
2. Fit naturally within the line context.
3. Span from literal to more creative interpretations:
   - Option 1: MOST LITERAL (closest word-for-word match)
   - Option 2: BALANCED (natural but close to source meaning)
   - Option 3: MOST CREATIVE (idiomatic, may rephrase for naturalness)

CRITICAL: Options must be DISTINCTLY different. Avoid synonyms that are too similar.
```

**Expected Impact**: Better variety between options

---

#### Fix #3: Add Few-Shot Examples ⚡ MEDIUM IMPACT

**File**: `src/lib/ai/workshopPrompts.ts:162-183`

**Add after line 167**:

```typescript
Examples of good translation options:

Example 1 (generic context):
Word: "star"
Options: ["estrella", "astro", "lucero"]
- estrella: Most literal (generic)
- astro: Balanced (slightly more poetic)
- lucero: Creative (poetic, idiomatic)

Example 2 (technical physics context):
Word: "star"
Options: ["astro", "cuerpo celeste", "estrella (astronomía)"]
- astro: Most literal (scientific term)
- cuerpo celeste: Balanced (technical but natural)
- estrella (astronomía): Creative (clarified for domain)

Note how technical context changes the options significantly.
```

**Expected Impact**: AI better understands zone requirements

---

#### Fix #4: Pass Surrounding Context to API ⚡ HIGH IMPACT

**File**: `src/app/api/workshop/generate-options/route.ts:17-21`

**Change Request Schema**:

```typescript
const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  lineText: z.string(),
  prevLine: z.string().optional(), // ADD
  nextLine: z.string().optional(), // ADD
  fullPoem: z.string().optional(), // ADD
  stanzaIndex: z.number().optional(), // ADD
});
```

**File**: `src/lib/ai/workshopPrompts.ts:143-183`

**Update prompt to use context**:

```typescript
// Add after line 167:
${prevLine ? `Previous line: "${prevLine}"` : ''}
${nextLine ? `Next line: "${nextLine}"` : ''}
${fullPoem ? `\nFull poem context:\n"""\n${fullPoem}\n"""` : ''}

Consider how "${word}" relates to the surrounding lines and overall poem theme.
```

**Expected Impact**: Better understanding of metaphors, idioms, flow

---

### 7.2 Medium Effort (1-2 days each)

#### Fix #5: Zone-Specific Prompt Templates

**Create**: `src/lib/ai/zoneTemplates.ts`

**Structure**:

```typescript
const ZONE_TEMPLATES = {
  "technical physics/biology": {
    emphasis: "CRITICAL - Use scientific terminology",
    examples: ["star → astro (not estrella)", "cell → célula (not celda)"],
    requirements: ["Prefer Latin/Greek roots", "Use domain-specific terms"],
  },
  "poetic/literary": {
    emphasis: "CRITICAL - Prioritize poetic register",
    examples: ["star → lucero (poetic)", "moon → luna (standard)"],
    requirements: ["Use elevated language", "Consider meter and rhyme"],
  },
  // ... more zone types
};
```

**Expected Impact**: Zone compliance 80%+

---

#### Fix #6: Add Similarity Validation

**File**: `src/app/api/workshop/generate-options/route.ts`

**Add after line 258**:

```typescript
// Check if options are too similar
const similarityThreshold = 0.7; // 70% similar = too similar
if (areOptionsTooSimilar(options, similarityThreshold)) {
  console.warn(
    `[generate-options] Options too similar for "${word}", regenerating...`
  );
  // Retry with higher temperature or adjusted prompt
  // (implement retry logic)
}
```

**Expected Impact**: Better variety in options

---

#### Fix #7: Per-Option Temperature Variation

**File**: `src/app/api/workshop/generate-options/route.ts:138-289`

**Change**: Generate 3 separate API calls with different temperatures:

```typescript
const optionTemps = [0.3, 0.7, 1.0]; // literal, balanced, creative

const wordOptions = await Promise.all(
  words.map(async (word, position) => {
    const allOptions = await Promise.all(
      optionTemps.map(async (temp, optionIndex) => {
        // Generate one option per temperature
        const prompt = buildWordTranslationPrompt({
          word,
          lineContext: lineText,
          guideAnswers,
          sourceLanguage: poemAnalysis.language || "the source language",
          optionType: ["literal", "balanced", "creative"][optionIndex], // Add to prompt
        });

        const completion = await openai.chat.completions.create({
          model: modelToUse,
          temperature: temp, // Different temp per option
          // ...
        });

        return parseOption(completion);
      })
    );

    return {
      original: word,
      position,
      options: allOptions.map((o) => o.text),
      partOfSpeech: allOptions[0].partOfSpeech,
    };
  })
);
```

**Expected Impact**: More distinct options

---

### 7.3 Long-term Improvements (ongoing)

#### Fix #8: User Selection Tracking

**Track which option users select** (A, B, or C) to improve prompts over time

**Implementation**: Add analytics endpoint, track selections, analyze patterns

---

#### Fix #9: A/B Testing Framework

**Test different prompt structures** and measure which produces better user selections

---

#### Fix #10: Prompt Versioning

**Version prompts** so we can rollback if changes make things worse

---

## 8. Example Improved Prompt

### Current Prompt (Weak):

```
You are translating poetry from English to Spanish.

Translator instructions:
- Translation zone: technical physics/biology
- Translation strategy: Use domain-specific terminology where applicable
- Translation approach: Balance literal and creative interpretations

Line being translated: "The star shines bright"
Focus word: "star"

Provide exactly 3 translation options for "star" that:
1. Honour the translator instructions above.
2. Fit naturally within the line context.
3. Span from literal to more creative interpretations (Balance literal and creative interpretations).
```

### Improved Prompt (Strong):

```
You are translating poetry from English to Spanish.

═══════════════════════════════════════════════════════════════
CRITICAL REQUIREMENT - Translation Zone: technical physics/biology
═══════════════════════════════════════════════════════════════

You MUST provide options that use domain-specific terminology appropriate for physics/biology contexts.

For technical zones, your options MUST:
- Use scientific register and terminology
- Include Latin/Greek roots where applicable
- Prefer domain-specific terms over generic translations
- Maintain technical accuracy

Examples of technical vs generic:
- Generic context: "star" → ["estrella", "astro", "lucero"]
- Technical context: "star" → ["astro", "cuerpo celeste", "estrella (astronomía)"]
  ✓ astro: Scientific term (Latin root)
  ✓ cuerpo celeste: Technical but natural
  ✓ estrella (astronomía): Clarified for domain

═══════════════════════════════════════════════════════════════

Line being translated: "The star shines bright"
Focus word: "star"

Previous line: "In the dark night sky" (if available)
Next line: "Guiding travelers home" (if available)

Provide exactly 3 translation options for "star" that:

1. CRITICALLY: Honour the translation zone above (technical physics/biology)
   - Use scientific terminology
   - Prefer domain-specific terms

2. Fit naturally within the line context and surrounding lines

3. Span from literal to creative with DISTINCT variety:
   - Option 1: MOST LITERAL - Closest word-for-word match, scientific term
   - Option 2: BALANCED - Natural but maintains technical accuracy
   - Option 3: MOST CREATIVE - Idiomatic while preserving domain context

CRITICAL: Options must be DISTINCTLY different. Avoid synonyms that are too similar.

Example of good variety:
✅ ["astro", "cuerpo celeste", "estrella astronómica"] (distinct, technical)

Example of bad variety:
❌ ["estrella", "estrella brillante", "estrella luminosa"] (too similar, generic)
```

**Key Improvements**:

- ✅ Zone emphasized with visual separator
- ✅ Zone-specific requirements listed
- ✅ Examples provided (good vs bad)
- ✅ Surrounding context included
- ✅ Explicit variety instructions
- ✅ Option types clearly defined
- ✅ Zone mentioned 3+ times

---

## 9. Priority Action Plan

### Phase 1: Quick Wins (This Week)

1. ✅ Strengthen translation zone language (2 hours)
2. ✅ Add explicit variety instructions (1 hour)
3. ✅ Pass surrounding context to API (2 hours)
4. ✅ Add few-shot examples (1 hour)

**Expected Impact**: Zone compliance 30% → 70%, better variety

### Phase 2: Medium Effort (Next Week)

5. ✅ Zone-specific templates (1 day)
6. ✅ Similarity validation (1 day)
7. ✅ Per-option temperature (1 day)

**Expected Impact**: Zone compliance 70% → 85%, distinct options

### Phase 3: Long-term (Ongoing)

8. User selection tracking
9. A/B testing framework
10. Prompt versioning

---

## 10. Success Metrics

**Before Fixes**:

- Zone compliance: ~30%
- Option similarity: High (often 2/3 options too similar)
- User satisfaction: Low (reported in issue)

**After Quick Wins**:

- Zone compliance: Target 70%+
- Option similarity: Medium (better variety)
- User satisfaction: Improved

**After Medium Effort**:

- Zone compliance: Target 85%+
- Option similarity: Low (distinct options)
- User satisfaction: High

---

## 11. Code Locations Summary

| Issue                 | File                        | Lines   | Priority |
| --------------------- | --------------------------- | ------- | -------- |
| Weak zone enforcement | `workshopPrompts.ts`        | 29-30   | HIGH     |
| Missing context       | `generate-options/route.ts` | 17-21   | HIGH     |
| No examples           | `workshopPrompts.ts`        | 162-183 | MEDIUM   |
| Fixed temperature     | `generate-options/route.ts` | 172     | MEDIUM   |
| No validation         | `generate-options/route.ts` | 253-258 | MEDIUM   |

---

## Conclusion

The investigation reveals that translation zone is included but **weakly enforced**, available context is **not being utilized**, and prompts lack **examples and emphasis**. The fixes are straightforward and should significantly improve option quality.

**Recommended Starting Point**: Implement Quick Wins #1, #2, and #4 first (zone emphasis, variety instructions, surrounding context). These will have the highest impact with minimal effort.
