# Active LLM Prompts Report: Currently Used Prompts

This document lists **only the prompts that are actively being used** in the current codebase, with notes on their usage patterns.

---

## ✅ Currently Active Prompts

### 1. **Line Translation with Alignment** ✅ PRIMARY METHOD

- **API Endpoint:** `/api/workshop/translate-line`
- **Used in:** `WordGrid.tsx` component (PRIMARY workflow)
- **Hook:** `useTranslateLine()` from `useTranslateLine.ts`
- **Prompt Functions:**
  - `buildLineTranslationPrompt()` (primary)
  - `buildLineTranslationSystemPrompt()` (primary)
  - `buildLineTranslationFallbackPrompt()` (fallback when alignment fails)
  - `buildLineTranslationFallbackSystemPrompt()` (fallback when alignment fails)
- **Status:** ✅ **PRIMARY METHOD** - This is the main translation method used when:
  - User selects a line in the workshop
  - `lineContext` is available (has full poem, stanza index, prev/next lines)
  - Background translation job processing (`runTranslationTick`)
- **Usage Pattern:** Tried FIRST, before falling back to word-by-word

---

### 2. **Word Translation Options** ⚠️ FALLBACK/LEGACY

- **API Endpoint:** `/api/workshop/generate-options`
- **Used in:** `WordGrid.tsx` component (FALLBACK only)
- **Hook:** `useGenerateOptions()` from `useWorkshopFlow.ts`
- **Prompt Functions:**
  - `buildWordTranslationPrompt()`
  - `buildWorkshopSystemPrompt()`
- **Status:** ⚠️ **FALLBACK METHOD** - Only used when:
  1. **Line translation fails** (error handler catches failure and falls back)
  2. **No line context available** (missing `lineContext` means can't do line translation)
- **Code Reference:** See `WordGrid.tsx` lines 272-342:
  - Line 274: "Try new line translation workflow first (if context is available)"
  - Line 273: "Fall back to old word-by-word if context is missing or translation fails"
  - Line 292-317: Error handler falls back to word-by-word
  - Line 321-342: If no context, uses word-by-word directly
- **Why Still Needed:**
  - Backward compatibility for cases where line context isn't available
  - Error recovery when line translation fails
  - Legacy support for older workflows

---

### 3. **AI-Assisted Refinement** ✅ ACTIVE (NOW VISIBLE)

- **API Endpoint:** `/api/notebook/ai-assist`
- **Component:** `AIAssistantPanel.tsx`
- **Used in:** `NotebookPhase6.tsx` component (currently active)
- **Prompt Functions:**
  - `buildAIAssistPrompt()`
  - `buildAIAssistSystemPrompt()`
- **Status:** ✅ **ACTIVELY USED** - Now visible in the UI:
  - **AI Assist Button:** Added to toolbar in `NotebookPhase6.tsx` (line 456-466)
  - **Button appears when:** User has selected a line AND has text in the compiled line textarea
  - **Keyboard shortcut:** `Cmd/Ctrl+Shift+A` to open AI Assist
  - **Location:** Toolbar next to Compare, Journey, and Poem buttons
  - **Functionality:** Opens overlay panel with "Write Myself" vs "AI Assist" modes
  - **AI Assist mode:** Generates refined translation suggestions based on user's current translation
- **How to Access:**
  1. Select a line in the Workshop
  2. Type or drag words into the Notebook to create a translation
  3. Click "AI Assist" button in the toolbar (or press `Cmd/Ctrl+Shift+A`)
  4. Select "AI Assist" mode in the panel
  5. AI will generate refined suggestions based on your translation

---

### 4. **Translation Quality Verification** ✅ ACTIVE

- **API Endpoint:** `/api/verification/grade-line`
- **Used in:** Verification system (Track A)
- **Prompt Functions:**
  - `buildVerificationPrompt()`
- **Status:** ✅ **ACTIVELY USED** - Called for internal quality assessment of AI-generated translation options

---

### 5. **Context Notes for Students** ✅ ACTIVE

- **API Endpoint:** `/api/verification/context-notes`
- **Used in:** `ContextNotes.tsx` component
- **Prompt Functions:**
  - `buildContextNotesPrompt()`
- **Status:** ✅ **ACTIVELY USED** - Provides educational explanations about translation options

---

### 6. **Journey Reflection Generation** ✅ ACTIVE

- **API Endpoint:** `/api/journey/generate-reflection`
- **Used in:** `JourneySummary.tsx` component
- **Prompt:** Inline prompt in `generate-reflection/route.ts`
- **Status:** ✅ **ACTIVELY USED** - Called when student completes translation and wants reflection

---

### 7. **Brief Feedback Generation** ✅ ACTIVE

- **API Endpoint:** `/api/journey/generate-brief-feedback`
- **Used in:** `useJourneyReflection()` hook
- **Prompt Functions:**
  - `buildJourneyFeedbackPrompt()`
  - `buildJourneyFeedbackSystemPrompt()`
- **Status:** ✅ **ACTIVELY USED** - Called when student writes a reflection and wants AI feedback

---

### 8. **Prismatic Translation Variants** ✅ ACTIVE

- **API Endpoint:** `/api/notebook/prismatic`
- **Used in:** `useNotebookFlow.ts` hook
- **Prompt:** Inline prompt in `prismatic/route.ts`
- **Status:** ✅ **ACTIVELY USED** - Called when user wants to see alternative translation approaches for a completed line

---

### 9. **Smart Interview Question Generation** ❌ DISABLED

- **API Endpoint:** `/api/interview/next`
- **Used in:** Not found in any component
- **Prompt:** Inline prompt in `interview/next/route.ts`
- **Status:** ❌ **DISABLED** - Endpoint exists but is **disabled by feature flag** (`isSmartInterviewLLMEnabled()` returns `false`). Not currently being used in the frontend. The flag file even has a comment: "Deprecated: interview clarifier removed from client usage."

---

## Summary

### ✅ **8 Prompts ACTIVELY USED (Primary):**

1. Line Translation with Alignment (PRIMARY translation method)
2. AI-Assisted Refinement (NOW VISIBLE - added to NotebookPhase6)
3. Translation Quality Verification
4. Context Notes for Students
5. Journey Reflection Generation
6. Brief Feedback Generation
7. Prismatic Translation Variants
8. Word Translation Options (FALLBACK only - see below)

### ⚠️ **1 Prompt FALLBACK/LEGACY:**

1. **Word Translation Options** - Still used but ONLY as fallback when:
   - Line translation fails
   - Line context is not available
   - This is legacy support, not the primary method

### ❌ **1 Prompt DISABLED:**

1. Smart Interview Question Generation (feature flag disabled)

### 🗑️ **2 Prompts REMOVED (No Longer Used):**

1. **Poem Analysis** - Removed from `/api/guide/analyze-poem` endpoint

   - Previously used LLM to analyze poem language, tone, themes, etc.
   - No longer called from frontend (client-side stanza detection used instead)
   - LLM prompt code removed from endpoint

2. **Stanza Detection (AI)** - Removed from `/api/workshop/detect-stanzas` endpoint
   - Previously used LLM to intelligently detect stanzas
   - No longer called from frontend (client-side 4-line splitting used instead)
   - LLM prompt code removed from endpoint
   - Endpoint now only uses local detection as fallback

---

## Key Finding: Word Translation Options Usage

**Word Translation Options is still used, but ONLY as a fallback mechanism.**

The workflow in `WordGrid.tsx` is:

1. **First:** Try Line Translation with Alignment (if `lineContext` available)
2. **If that fails or no context:** Fall back to Word Translation Options (old word-by-word method)

This means:

- **Primary workflow:** Line Translation (newer, better method)
- **Fallback workflow:** Word Translation Options (legacy support)

The Word Translation Options prompt is still needed for:

- Error recovery when line translation fails
- Backward compatibility when line context isn't available
- Legacy support for edge cases

However, in normal operation with proper context, **Line Translation is always used first**, and Word Translation Options is only a safety net.

---

## Recommendation

If you want to fully deprecate Word Translation Options:

1. Ensure `lineContext` is always available when a line is selected
2. Improve error handling for line translation to retry instead of falling back
3. Remove the fallback code paths in `WordGrid.tsx`
4. Remove the `/api/workshop/generate-options` endpoint
5. Remove `buildWordTranslationPrompt()` and `buildWorkshopSystemPrompt()` functions

But currently, it's still serving as important fallback/legacy support.
