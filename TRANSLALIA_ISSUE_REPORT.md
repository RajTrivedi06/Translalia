# Translalia Issue Investigation Report

**Generated:** 2025-12-12  
**Codebase:** /Users/raaj/Documents/CS/AIDCPT/translalia-web/  
**Note:** Paths verified against current codebase structure post-cleanup

## Executive Summary

- Total Issues: 20
- Critical: 3
- High: 3
- Medium: 8
- Low: 6

### Quick Reference - File Locations Found

| Feature         | Current Location                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Zustand Stores  | `translalia-web/src/store/` (`guideSlice.ts`, `workshopSlice.ts`, `notebookSlice.ts`, `workspace.ts`)     |
| API Routes      | `translalia-web/src/app/api/**/route.ts`                                                                  |
| Main Components | `translalia-web/src/components/` (`guide/`, `notebook/`, `workshop-rail/`, `auth/`, `ui/`)                |
| Guide/Setup     | `translalia-web/src/components/guide/GuideRail.tsx` + `translalia-web/src/store/guideSlice.ts`            |
| Notebook        | `translalia-web/src/components/notebook/NotebookPhase6.tsx` + `translalia-web/src/store/notebookSlice.ts` |

---

## Issue #1: Home Button Not Working

**Severity:** Medium  
**Category:** Bug/Missing wiring  
**Status:** Confirmed

### Files Found

| File                                             | Purpose                       | Key Lines |
| ------------------------------------------------ | ----------------------------- | --------- |
| `translalia-web/src/app/[locale]/layout.tsx`     | Header brand rendered         | L58-L66   |
| `translalia-web/src/components/auth/AuthNav.tsx` | Primary nav includes `/` link | L12-L28   |

### Root Cause Analysis

The header brand text (`Translalia`) is not a link/button, so clicking it does nothing.

### Reproduction Steps

1. Open any page under `/{locale}/(app)`.
2. Click the header brand.
3. Expected: go to home.
4. Actual: no navigation.

### Suggested Fix

Wrap the brand in the locale-aware `Link` from `@/i18n/routing`.

---

## Issue #2: “Create New Workspace” Button Causes Section Shrink

**Severity:** Low  
**Category:** UI/Layout shift  
**Status:** Partially Confirmed (needs visual repro)

### Files Found

| File                                                        | Purpose               | Key Lines |
| ----------------------------------------------------------- | --------------------- | --------- |
| `translalia-web/src/app/[locale]/(app)/workspaces/page.tsx` | Create workspace form | L83-L101  |

### Root Cause Analysis

Button label changes (creating vs create) in a responsive flex row; different text widths can cause layout shift.

### Suggested Fix

Give the button a stable width (`min-w-*`) or reserve space for the loading label.

---

## Issue #3: New Chat Creation Doesn’t Update Previous Chat State

**Severity:** High  
**Category:** Bug (thread scoping / hydration race)  
**Status:** Confirmed (race still plausible)

### Files Found

| File                                                                                                   | Purpose                                      | Key Lines        |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ---------------- |
| `translalia-web/src/app/[locale]/(app)/workspaces/[projectId]/page.tsx`                                | Creates thread + refetch + push              | L73-L93          |
| `translalia-web/src/lib/threadStorage.ts`                                                              | Thread-aware persist storage + active thread | L15-L26, L28-L47 |
| `translalia-web/src/app/[locale]/(app)/workspaces/[projectId]/threads/[threadId]/ThreadPageClient.tsx` | Sets active thread id after mount            | L34-L36          |
| `docs/diagnostics/new_chat_state_leak.md`                                                              | RCA notes                                    | L190-L205        |

### Root Cause Analysis

`getActiveThreadId()` returns in-memory `activeThreadId` before parsing the URL. During fast navigation, this can briefly reference the previous thread.

### Suggested Fix

Prefer URL-derived thread id first (pathname parse), then fall back to `activeThreadId` / `last-thread-id`.

---

## Issue #4: “Let’s Get Started” Section Auto-Collapse Issue

**Severity:** Critical  
**Category:** Bug (wrong navigation target)  
**Status:** Confirmed

### Files Found

| File                                                                                                   | Purpose                              | Key Lines |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------ | --------- |
| `translalia-web/src/components/guide/GuideRail.tsx`                                                    | Start workshop confirm + navigation  | L336-L345 |
| `translalia-web/src/app/[locale]/(app)/workspaces/[projectId]/threads/[threadId]/ThreadPageClient.tsx` | Local collapsed state controls panel | L50-L55   |
| `translalia-web/src/lib/routers.tsx`                                                                   | Correct route helper exists          | L8-L13    |

### Root Cause Analysis

`GuideRail` navigates with `router.push(`/workspaces/${threadId}/threads/${threadId}`)` which incorrectly uses `threadId` as `projectId`.

### Suggested Fix

Use `routes.projectWithThread(projectId, threadId)` or derive `projectId` from params.

---

## Issue #5: LineProgressIndicator Component Issues

**Severity:** Medium  
**Category:** Bug / stale status logic  
**Status:** Confirmed

### Files Found

| File                                                               | Purpose                    | Key Lines |
| ------------------------------------------------------------------ | -------------------------- | --------- |
| `translalia-web/src/components/notebook/LineProgressIndicator.tsx` | Uses `completedLines` only | L37-L45   |
| `translalia-web/src/store/workshopSlice.ts`                        | Line workflow state        | L44-L49   |

### Root Cause Analysis

Indicator completion is derived only from `completedLines`, ignoring “draft/in-progress” states.

---

## Issue #6: Major State Issues on Page Refresh

**Severity:** Critical  
**Category:** Bug (persist/hydration)  
**Status:** Confirmed

### Files Found

| File                                                                                                   | Purpose                                | Key Lines          |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------- | ------------------ |
| `translalia-web/src/store/guideSlice.ts`                                                               | UI state not persisted in `partialize` | L66-L70, L333-L340 |
| `translalia-web/src/app/[locale]/(app)/workspaces/[projectId]/threads/[threadId]/ThreadPageClient.tsx` | Local collapse state resets on refresh | L50-L55            |

### Root Cause Analysis

Guide UI state (`isWorkshopUnlocked`, `isCollapsed`, `width`) isn’t included in persisted subset; guide panel collapse is also kept only in component local state.

---

## Issue #7: Assembled Translation View Shows Incorrect Status

**Severity:** High  
**Category:** Bug (status semantics)  
**Status:** Confirmed

### Files Found

| File                                                           | Purpose                                                | Key Lines            |
| -------------------------------------------------------------- | ------------------------------------------------------ | -------------------- |
| `translalia-web/src/components/workshop-rail/WorkshopRail.tsx` | Hydrates background translations into `completedLines` | L69-L122, L269-L324  |
| `translalia-web/src/components/notebook/PoemAssembly.tsx`      | Marks any `completedLines[idx]` as “Complete”          | L410-L452            |
| `translalia-web/src/components/notebook/NotebookPhase6.tsx`    | Manual finalization is tracked locally only            | L111-L114, L316-L324 |

### Root Cause Analysis

`completedLines` conflates “AI-generated translation exists” and “student finalized”. UI treats both as “Complete”.

---

## Issue #8: Poem Suggestions Button Not Working

**Severity:** High  
**Category:** Bug (request validation mismatch)  
**Status:** Confirmed

### Files Found

| File                                                            | Purpose                                 | Key Lines            |
| --------------------------------------------------------------- | --------------------------------------- | -------------------- |
| `translalia-web/src/components/notebook/NotebookPhase6.tsx`     | Opens PoemSuggestions panel             | L583-L592, L884-L900 |
| `translalia-web/src/app/api/notebook/poem-suggestions/route.ts` | Requires `translationPoem` length >= 10 | L27-L32              |

### Root Cause Analysis

`translationPoem` passed is built from current `droppedCells` (often empty/short), but API schema requires min length.

---

## Issue #9: “View Assembled Poem” Button Not Working

**Severity:** Medium  
**Category:** Bug/Needs testing  
**Status:** Needs Manual Testing

### Files Found

| File                                                        | Purpose                      | Key Lines            |
| ----------------------------------------------------------- | ---------------------------- | -------------------- |
| `translalia-web/src/components/notebook/NotebookPhase6.tsx` | Action toggles poem assembly | L609-L615, L447-L469 |

### Root Cause Analysis

Code path exists; no obvious missing handler. Likely UI/overlay/hydration issue.

---

## Issue #10: Drag-and-Drop + Double-Click Feature

**Severity:** Low  
**Category:** Enhancement  
**Status:** Partially Confirmed

### Files Found

| File                                                                                                   | Purpose                     | Key Lines |
| ------------------------------------------------------------------------------------------------------ | --------------------------- | --------- |
| `translalia-web/src/app/[locale]/(app)/workspaces/[projectId]/threads/[threadId]/ThreadPageClient.tsx` | DnD context + drop handling | L54-L76   |
| `translalia-web/src/components/workshop-rail/WordGrid.tsx`                                             | Draggable tokens            | L633-L638 |
| `translalia-web/src/components/notebook/TranslationCell.tsx`                                           | Double-click edit           | L113-L114 |

---

## Issue #11: Cell Editing Causes Other Cells to Resize

**Severity:** Medium  
**Category:** UI/Layout  
**Status:** Partially Confirmed

### Files Found

| File                                                          | Purpose                        | Key Lines            |
| ------------------------------------------------------------- | ------------------------------ | -------------------- |
| `translalia-web/src/components/notebook/NotebookDropZone.tsx` | Arrange mode uses `flex-wrap`  | L118-L123            |
| `translalia-web/src/components/notebook/TranslationCell.tsx`  | Editing toggles to larger Card | L157-L176, L300-L315 |

---

## Issue #12: Additional Word Suggestion Feature

**Severity:** Low  
**Category:** Missing Feature  
**Status:** Feature appears unimplemented

### Notes

Manual “Custom” entry exists in `WordGrid`, but no AI “more options” endpoint found.

---

## Issue #13: Line Translation Options Quality

**Severity:** Medium  
**Category:** Investigation Needed  
**Status:** Confirmed (prompt + model located)

### Files Found

| File                                                          | Purpose                           | Key Lines |
| ------------------------------------------------------------- | --------------------------------- | --------- |
| `translalia-web/src/lib/ai/workshopPrompts.ts`                | Line translation prompt templates | L437-L565 |
| `translalia-web/src/app/api/workshop/translate-line/route.ts` | Calls `translateLineInternal`     | L148-L165 |
| `translalia-web/src/lib/models.ts`                            | Model defaults                    | L1-L3     |

---

## Issue #14: Multi-Language App Version

**Severity:** Low  
**Category:** Enhancement/Investigation  
**Status:** Partially Confirmed

### Files Found

| File                                 | Purpose                                  | Key Lines |
| ------------------------------------ | ---------------------------------------- | --------- |
| `translalia-web/src/i18n/routing.ts` | `next-intl` routing, localePrefix always | L4-L13    |
| `translalia-web/next.config.ts`      | next-intl plugin configured              | L3-L6     |

### Notes

No explicit Language/Locale selector component located.

---

## Issue #15: Make Translation Zone and Intent Mandatory

**Severity:** Low  
**Category:** Already implemented  
**Status:** Confirmed

### Files Found

| File                                                | Purpose                                          | Key Lines |
| --------------------------------------------------- | ------------------------------------------------ | --------- |
| `translalia-web/src/store/guideSlice.ts`            | `checkGuideComplete()` enforces poem+zone+intent | L252-L261 |
| `translalia-web/src/components/guide/GuideRail.tsx` | Blocks start when incomplete                     | L310-L323 |

---

## Issue #16: Remove Poem Analysis Feature

**Severity:** Low  
**Category:** Cleanup  
**Status:** Partially Confirmed

### Files Found

| File                                                            | Purpose                                    | Key Lines    |
| --------------------------------------------------------------- | ------------------------------------------ | ------------ |
| `translalia-web/src/lib/hooks/useGuideFlow.ts`                  | `useAnalyzePoem` removed                   | L12-L13, L29 |
| `translalia-web/src/lib/workshop/runTranslationTick.ts`         | Still reads `state.poem_analysis` language | L53-L68      |
| `translalia-web/src/app/api/workshop/generate-options/route.ts` | Reads `state.poem_analysis`                | L99-L102     |

---

## Issue #17: AI-Assisted Refinement Not Accessible

**Severity:** Medium  
**Category:** UX  
**Status:** Partially Confirmed

### Files Found

| File                                                        | Purpose                              | Key Lines |
| ----------------------------------------------------------- | ------------------------------------ | --------- |
| `translalia-web/src/components/notebook/NotebookPhase6.tsx` | AI Assist behind menu + state guards | L567-L574 |
| `translalia-web/src/app/api/notebook/ai-assist/route.ts`    | Endpoint exists                      | L18-L45   |

---

## Issue #18: Prismatic Variants Quality

**Severity:** Medium  
**Category:** Investigation Needed  
**Status:** Confirmed

### Files Found

| File                                                     | Purpose                 | Key Lines |
| -------------------------------------------------------- | ----------------------- | --------- |
| `translalia-web/src/app/api/notebook/prismatic/route.ts` | Prompt + model settings | L147-L201 |

---

## Issue #19: Word Translation Prompt Status

**Severity:** Low  
**Category:** Investigation/Decision  
**Status:** Confirmed (used)

### Files Found

| File                                                            | Purpose                        | Key Lines |
| --------------------------------------------------------------- | ------------------------------ | --------- |
| `translalia-web/src/lib/ai/workshopPrompts.ts`                  | `buildWordTranslationPrompt()` | L143-L183 |
| `translalia-web/src/app/api/workshop/generate-options/route.ts` | Uses it                        | L141-L147 |

---

## Issue #20: Client-Side Exception on App Open / Second Session

**Severity:** Critical  
**Category:** Bug (storage access / hydration)  
**Status:** Confirmed (risk present; exact runtime error needs capture)

### Files Found

| File                                      | Purpose                                                 | Key Lines |
| ----------------------------------------- | ------------------------------------------------------- | --------- |
| `translalia-web/src/lib/threadStorage.ts` | localStorage calls in storage adapter without try/catch | L28-L47   |

### Root Cause Analysis

If localStorage throws (blocked storage, quota, privacy mode), persisted store hydration can crash.

---

## Execution Checklist

- [x] Mapped current directory structure
- [x] Located all Zustand stores
- [x] Located all API routes
- [x] Verified file paths exist at time of writing
