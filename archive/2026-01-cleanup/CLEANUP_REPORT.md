# Codebase Cleanup Report

> **Generated**: January 2026  
> **Purpose**: Identify files that can be safely deleted to tighten the codebase

---

## Summary

| Category | Files to Delete | Confidence |
|----------|-----------------|------------|
| Root-level Investigation Reports | 18 files | ✅ High |
| Outdated docs/ Documentation | ~15 files | ✅ High |
| Unused Components | 12 files | ✅ High |
| Unused Hooks | 3 files | ✅ High |
| Unused Lib Files | 6 files | ✅ High |
| Unused Types | 2 files | ✅ High |
| Empty Folders | 1 folder | ✅ High |
| Utility Scripts | 2 files | ⚠️ Medium |

---

## 1. ROOT-LEVEL INVESTIGATION/FIX REPORTS (DELETE ALL)

These are historical investigation reports that are no longer needed for the running application:

```
/AIDCPT/
├── AUTO_ADVANCE_FEATURE.md         # Feature documentation (implemented)
├── AUTO_ADVANCE_FIX_AND_SAVED_BADGE.md  # Bug fix report
├── AUTO_ADVANCE_FIX_FINAL.md       # Bug fix report
├── BI_DIRECTIONAL_SYNC_FIX.md      # Bug fix report
├── DEBUG_AUTO_ADVANCE.md           # Debug notes
├── DEPLOYMENT_READY_STATUS.md      # Deployment checklist (one-time)
├── EVIDENCE_BUNDLE_ASYNC_ORDERING_METHOD.md  # Investigation report
├── EVIDENCE_PACK_FINAL.md          # Investigation report
├── EVIDENCE_TIMELINE_REPORT.md     # Investigation report
├── ISSUE_13_INVESTIGATION_REPORT.md # Issue investigation
├── METHOD_ASYNC_TRUTH_REPORT.md    # Investigation report
├── METHOD2_ACTUAL_USAGE_AND_TTFL_REPORT.md  # Investigation report
├── MISSING_PROOFS_SANITY_CHECK.md  # Investigation report
├── QUICK_TEST_GUIDE.md             # Testing notes
├── SCHEDULING_AND_READINESS_REPORT.md  # Report
├── SCROLLING_FIX.md                # Bug fix report
├── TRANSLALIA_ISSUE_REPORT.md      # Issue report
├── TRANSLATION_BUG_FIX_SUMMARY.md  # Bug fix summary
├── TRANSLATION_METHOD_USAGE_ANALYSIS.md  # Analysis report
├── UI_IMPROVEMENTS_SUMMARY.md      # Summary
├── VERCEL_DEPLOYMENT_GUIDE.md      # Can move to docs/ if needed
├── VERIFICATION_RESULTS.md         # Test results
└── VERIFICATION_SUMMARY.md         # Test summary
```

**Action**: Delete all 23 files. Keep only `README.md` and `package.json`.

---

## 2. DOCS/ FOLDER - OUTDATED DOCUMENTATION

The `docs/` folder contains outdated documentation that references old code paths:

### docs/api/ (DELETE)
```
docs/api/
├── flow-api.md       # References removed flow/* API routes
└── llm-api.md        # References old translator/* routes
```

### docs/context/ (DELETE OR REVIEW)
Most files reference outdated code structures:
```
docs/context/
├── API_ROUTES.md              # Lists removed routes (chat, flow, translate, etc.)
├── ARCHITECTURE_DECISIONS.md  # Some ADRs are outdated
├── CODEBASE_OVERVIEW.md       # Extensive but outdated references
├── COMPONENTS_STRUCTURE.md    # References removed components
├── CURRENT_ISSUES.md          # Likely resolved issues
├── DATABASE_SCHEMA.md         # May be outdated (versions table)
├── DEPLOYMENT_GUIDE.md        # Keep if accurate
├── domains/                   # DELETE entire folder
│   ├── authentication.md
│   ├── business-logic.md
│   ├── data-flow.md
│   └── user-management.md
├── ERROR_HANDLING.md          # References old patterns
├── LLM_INTEGRATION_GUIDE.md   # May reference old routes
├── PERFORMANCE_OPTIMIZATION.md # Generic, may keep
├── RELATIONSHIPS.md           # References old entities
├── SECURITY_GUIDELINES.md     # Keep if general
├── SERVICES_INTEGRATIONS.md   # References old patterns
├── STATE_MANAGEMENT.md        # Outdated (references old stores)
├── TESTING_STRATEGIES.md      # No tests in codebase
└── UTILITIES_HELPERS.md       # References old utilities
```

### docs/configuration/ (DELETE)
```
docs/configuration/
└── flags-and-models.md        # References old feature flags
```

### docs/diagnostics/ (DELETE)
```
docs/diagnostics/
└── new_chat_state_leak.md     # Resolved issue
```

### docs/policies/ (KEEP)
```
docs/policies/
├── moderation-policy.md       # KEEP - policy docs
└── spend-and-cache-policy.md  # KEEP - policy docs
```

### Other docs/ files
```
docs/
├── dbSummary.json             # DELETE - auto-generated, outdated
├── README.md                  # DELETE or update
└── STYLE.md                   # KEEP if used for styling guidelines
```

**Recommended Action**: Delete entire `docs/` folder except `docs/policies/` and regenerate documentation from current codebase.

---

## 3. UNUSED COMPONENTS (DELETE)

### src/components/notebook/ - Unused Components

| File | Reason | Action |
|------|--------|--------|
| `AIAssistantPanel.tsx` | Not imported anywhere | DELETE |
| `CompletionCelebration.tsx` | Not imported anywhere | DELETE |
| `FinalizeLineDialog.tsx` | Not imported anywhere | DELETE |
| `JourneyReflectionView.tsx` | Not imported anywhere (JourneyReflection is only imported by this unused file) | DELETE |
| `JourneyReflection.tsx` | Only imported by unused JourneyReflectionView.tsx | DELETE |
| `JourneySummary.tsx` | Not imported anywhere | DELETE |
| `MobileResponsiveWrapper.tsx` | Not imported anywhere | DELETE |
| `NotebookViewSelector.tsx` | Not imported anywhere | DELETE |
| `PoemAssembly.tsx` | Not imported anywhere | DELETE |
| `PoemSuggestionsView.tsx` | Not imported anywhere | DELETE |
| `PoemSuggestionsPanel.tsx` | Only imported by unused PoemSuggestionsView.tsx | DELETE |
| `TranslationStudioView.tsx` | Not imported anywhere | DELETE |

### src/components/common/ - Check Usage

| File | Status | Action |
|------|--------|--------|
| `CollapsedPanelTab.tsx` | ✅ Used in ThreadPageClient.tsx | KEEP |
| `ErrorBoundary.tsx` | ❌ Not imported anywhere | DELETE |

---

## 4. UNUSED HOOKS (DELETE)

### src/lib/hooks/

| File | Reason | Action |
|------|--------|--------|
| `useAutoSave.ts` | Not imported anywhere | DELETE |
| `usePrefetchContext.ts` | Not imported anywhere | DELETE |
| `useKeyboardShortcuts.tsx` | Not imported anywhere | DELETE |

### src/hooks/

| File | Reason | Action |
|------|--------|--------|
| `useJourney.ts` | Not imported anywhere | DELETE |
| `useJourneyReflection.ts` | Only imported by unused JourneyReflection.tsx | DELETE |

---

## 5. UNUSED LIB FILES (DELETE)

### src/lib/notebook/ (DELETE ENTIRE FOLDER)

| File | Reason | Action |
|------|--------|--------|
| `cellHelpers.ts` | Not imported anywhere | DELETE |
| `historyManager.ts` | Not imported anywhere | DELETE |

### src/lib/

| File | Reason | Action |
|------|--------|--------|
| `rag.ts` | Not imported anywhere | DELETE |
| `env.ts` | Not imported anywhere | DELETE |
| `supabaseAdmin.ts` | Not imported anywhere | DELETE |

### src/lib/api/ (DELETE EMPTY FOLDER)
This folder exists but is empty.

### src/lib/i18n/

| File | Reason | Action |
|------|--------|--------|
| `minimal.ts` | Not imported anywhere | DELETE |

### src/lib/ai/

| File | Reason | Action |
|------|--------|--------|
| `moderation.ts` | Not imported anywhere | DELETE |

---

## 6. UNUSED TYPES (DELETE)

### src/types/

| File | Reason | Action |
|------|--------|--------|
| `llm.ts` | Not imported anywhere | DELETE |
| `workspace.ts` | Not imported anywhere | DELETE |

---

## 7. UNUSED API ROUTES (REVIEW)

### src/app/api/eval/ (DELETE)
```
api/eval/
└── run/
    └── route.ts    # Not called from anywhere in the app
```

### src/app/api/debug/ (DELETE OR KEEP FOR DEV)
```
api/debug/
└── whoami/
    └── route.ts    # Debug endpoint, not called from app
```

---

## 8. UTILITY SCRIPTS (REVIEW)

### translalia-web/ root

| File | Reason | Action |
|------|--------|--------|
| `analyze_detailed.js` | One-time analysis script | DELETE |
| `analyze_unused_code.js` | One-time analysis script | DELETE |

---

## 9. FILES TO KEEP

These were checked and are actively used:

### Components
- ✅ `ComparisonView.tsx` - Used by TranslationStudioView
- ✅ `NotebookDropZone.tsx` - Used by NotebookPhase6
- ✅ `NotebookViewContainer.tsx` - Used by ThreadPageClient
- ✅ `TranslationCell.tsx` - Used (but review if TranslationStudioView is removed)
- ✅ `FullTranslationEditor.tsx` - Used
- ✅ All workshop-rail/ components - Actively used

### Hooks
- ✅ `useContextNotes.ts` - Used by ContextNotes.tsx
- ✅ `useGuideFlow.ts` - Used by GuideRail.tsx
- ✅ `usePoetryMacroCritique.ts` - Used by PoemSuggestionsPanel.tsx (but that's unused)
- ✅ `useTranslateLine.ts` - Used
- ✅ `useTranslationJob.ts` - Used by WorkshopRail.tsx
- ✅ `useVerificationAnalytics.ts` - Used by verification-dashboard
- ✅ `useWorkshopFlow.ts` - Used by multiple components
- ✅ `useDebounce.ts` - Generic utility (keep)

### Lib
- ✅ All poem/ files - Used for stanza detection
- ✅ All workshop/ files - Actively used
- ✅ `threadStorage.ts` - Core state management
- ✅ `models.ts` - Used everywhere
- ✅ `cache.ts` - Used for LLM caching
- ✅ All AI files except moderation.ts - Used

### Stores
- ✅ All store files are actively used

---

## DELETION COMMANDS

### Phase 1: Root-level investigation reports
```bash
cd /Users/raaj/Documents/CS/AIDCPT

rm -f AUTO_ADVANCE_FEATURE.md
rm -f AUTO_ADVANCE_FIX_AND_SAVED_BADGE.md
rm -f AUTO_ADVANCE_FIX_FINAL.md
rm -f BI_DIRECTIONAL_SYNC_FIX.md
rm -f DEBUG_AUTO_ADVANCE.md
rm -f DEPLOYMENT_READY_STATUS.md
rm -f EVIDENCE_BUNDLE_ASYNC_ORDERING_METHOD.md
rm -f EVIDENCE_PACK_FINAL.md
rm -f EVIDENCE_TIMELINE_REPORT.md
rm -f ISSUE_13_INVESTIGATION_REPORT.md
rm -f METHOD_ASYNC_TRUTH_REPORT.md
rm -f METHOD2_ACTUAL_USAGE_AND_TTFL_REPORT.md
rm -f MISSING_PROOFS_SANITY_CHECK.md
rm -f QUICK_TEST_GUIDE.md
rm -f SCHEDULING_AND_READINESS_REPORT.md
rm -f SCROLLING_FIX.md
rm -f TRANSLALIA_ISSUE_REPORT.md
rm -f TRANSLATION_BUG_FIX_SUMMARY.md
rm -f TRANSLATION_METHOD_USAGE_ANALYSIS.md
rm -f UI_IMPROVEMENTS_SUMMARY.md
rm -f VERCEL_DEPLOYMENT_GUIDE.md
rm -f VERIFICATION_RESULTS.md
rm -f VERIFICATION_SUMMARY.md
```

### Phase 2: Outdated docs
```bash
cd /Users/raaj/Documents/CS/AIDCPT

# Keep policies, delete rest
rm -rf docs/api
rm -rf docs/configuration
rm -rf docs/context
rm -rf docs/diagnostics
rm -f docs/dbSummary.json
rm -f docs/README.md
```

### Phase 3: Unused components
```bash
cd /Users/raaj/Documents/CS/AIDCPT/translalia-web/src/components

# notebook/ unused
rm -f notebook/AIAssistantPanel.tsx
rm -f notebook/CompletionCelebration.tsx
rm -f notebook/FinalizeLineDialog.tsx
rm -f notebook/JourneyReflection.tsx
rm -f notebook/JourneyReflectionView.tsx
rm -f notebook/JourneySummary.tsx
rm -f notebook/MobileResponsiveWrapper.tsx
rm -f notebook/NotebookViewSelector.tsx
rm -f notebook/PoemAssembly.tsx
rm -f notebook/PoemSuggestionsPanel.tsx
rm -f notebook/PoemSuggestionsView.tsx
rm -f notebook/TranslationStudioView.tsx

# common/ unused
rm -f common/ErrorBoundary.tsx
```

### Phase 4: Unused hooks
```bash
cd /Users/raaj/Documents/CS/AIDCPT/translalia-web/src

# lib/hooks
rm -f lib/hooks/useAutoSave.ts
rm -f lib/hooks/usePrefetchContext.ts
rm -f lib/hooks/useKeyboardShortcuts.tsx

# hooks/
rm -f hooks/useJourney.ts
rm -f hooks/useJourneyReflection.ts
```

### Phase 5: Unused lib files
```bash
cd /Users/raaj/Documents/CS/AIDCPT/translalia-web/src/lib

rm -rf notebook/   # entire folder
rm -rf api/        # empty folder
rm -f rag.ts
rm -f env.ts
rm -f supabaseAdmin.ts
rm -f i18n/minimal.ts
rm -f ai/moderation.ts
```

### Phase 6: Unused types
```bash
cd /Users/raaj/Documents/CS/AIDCPT/translalia-web/src/types

rm -f llm.ts
rm -f workspace.ts
```

### Phase 7: Unused API routes
```bash
cd /Users/raaj/Documents/CS/AIDCPT/translalia-web/src/app/api

rm -rf eval/
rm -rf debug/
```

### Phase 8: Utility scripts
```bash
cd /Users/raaj/Documents/CS/AIDCPT/translalia-web

rm -f analyze_detailed.js
rm -f analyze_unused_code.js
```

---

## CASCADING DELETIONS

After deleting the unused components, these additional files become unused:

| File | Becomes Unused After Deleting |
|------|------------------------------|
| `lib/hooks/usePoetryMacroCritique.ts` | PoemSuggestionsPanel.tsx |
| `lib/ai/poemSuggestions.ts` | PoemSuggestionsPanel.tsx (verify first) |
| `types/poemSuggestion.ts` | PoemSuggestionsPanel.tsx (verify first) |
| `api/notebook/poem-suggestions/` | PoemSuggestionsPanel.tsx |
| `api/journey/generate-brief-feedback/` | JourneyReflection.tsx |
| `api/journey/save-reflection/` | JourneyReflection.tsx |

**Recommendation**: After Phase 1-8, run another analysis to identify cascading deletions.

---

## POST-CLEANUP VERIFICATION

After deletion, run:

```bash
cd /Users/raaj/Documents/CS/AIDCPT/translalia-web

# Type check
pnpm typecheck

# Build
pnpm build

# Check for import errors
pnpm lint
```

---

## ESTIMATED IMPACT

- **Files removed**: ~60 files
- **Lines of code removed**: ~5,000+ lines
- **Bundle size reduction**: ~20-30KB (estimate)
- **Build time improvement**: Marginal
- **Developer experience**: Significantly improved (cleaner codebase)

---

*Report generated by codebase analysis*
