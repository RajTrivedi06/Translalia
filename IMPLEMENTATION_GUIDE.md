# Complete Implementation Guide: Validation → Confirmation → Background Processing

## Overview

This guide documents the three-phase implementation that connects the "Let's Get Started" guide with the workshop translation engine through validation, user confirmation, and automated background processing.

**Flow:** Validation ➜ Confirmation Dialog ➜ Initialize Translation Job ➜ Background Processing

---

## Phase 1: Validation System

### File: `src/store/guideSlice.ts`

**What was added:**
- `checkGuideComplete(): boolean` method in `GuideState` interface
- Validation logic that checks all three required fields:
  - Poem text (non-empty)
  - Translation Zone (non-empty)
  - Translation Intent (non-empty)

**Key Implementation:**
```typescript
checkGuideComplete: () => {
  const state = get();

  const hasPoem = state.poem.text.trim().length > 0;
  const hasTranslationZone = state.translationZone.text.trim().length > 0;
  const hasTranslationIntent =
    (state.translationIntent.text?.trim().length ?? 0) > 0;

  return hasPoem && hasTranslationZone && hasTranslationIntent;
}
```

**Returns:** `true` if all fields are complete, `false` otherwise

---

## Phase 2: Confirmation Dialog Component

### File: `src/components/guide/ConfirmationDialog.tsx` (NEW)

**Purpose:** Provides a user-friendly confirmation step before initiating background processing

**Features:**
- ✅ Customizable title, description, and button labels
- ✅ Async/await support for `onConfirm` handler
- ✅ Loading spinner during async operations
- ✅ Full accessibility (ARIA labels, focus management)
- ✅ Integrates with existing Dialog UI components

**Props Interface:**
```typescript
interface ConfirmationDialogProps {
  open: boolean;                           // Dialog visibility
  onOpenChange: (open: boolean) => void;   // Called when dialog should close
  onConfirm: () => void | Promise<void>;   // Called when user confirms
  isLoading?: boolean;                     // Shows spinner and disables buttons
  title?: string;                          // Dialog title
  description?: string;                    // Dialog description text
  confirmText?: string;                    // Confirm button label
  cancelText?: string;                     // Cancel button label
}
```

**Usage Example:**
```typescript
<ConfirmationDialog
  open={showConfirmDialog}
  onOpenChange={setShowConfirmDialog}
  onConfirm={handleConfirmWorkshop}
  isLoading={isConfirmingWorkshop}
  title="Ready to start the workshop?"
  description="Your poem, translation zone, and translation intent are set..."
  confirmText="Start Workshop"
  cancelText="Cancel"
/>
```

---

## Phase 3: Background Processing Integration

### File: `src/components/guide/GuideRail.tsx`

**New State Variables:**
```typescript
const [showConfirmDialog, setShowConfirmDialog] = useState(false);      // Dialog visibility
const [validationError, setValidationError] = useState<string | null>(null); // Error messages
const [isConfirmingWorkshop, setIsConfirmingWorkshop] = useState(false); // Loading state
```

**Handler Functions:**

#### 1. `handleStartWorkshop()`
Called when user clicks "Start Workshop" button.

**Logic:**
1. Validates all fields using `checkGuideComplete()`
2. If validation fails: Shows error message in red box
3. If validation succeeds: Opens confirmation dialog
4. Clears any previous errors

```typescript
const handleStartWorkshop = () => {
  const isComplete = checkGuideComplete();

  if (!isComplete) {
    setValidationError(
      "Please fill in all required fields: Poem, Translation Zone, and Translation Intent"
    );
    return;
  }

  setValidationError(null);
  setShowConfirmDialog(true);
};
```

#### 2. `handleConfirmWorkshop()` (async)
Called when user confirms in the dialog.

**Logic:**
1. Validates thread ID exists
2. Calls `/api/workshop/initialize-translations` endpoint
3. Passes `threadId` and `runInitialTick: true`
4. On success: Closes dialog and clears errors
5. On error: Shows error message to user
6. Always: Sets loading state back to false

```typescript
const handleConfirmWorkshop = async () => {
  setIsConfirmingWorkshop(true);
  try {
    if (!threadId) {
      setValidationError("No thread ID found. Please refresh and try again.");
      return;
    }

    // ✅ Initialize translation job in background
    const response = await fetch("/api/workshop/initialize-translations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        runInitialTick: true, // Start processing immediately
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to initialize translations");
    }

    // ✅ Success: close dialog and proceed
    setShowConfirmDialog(false);
    setValidationError(null);

    // Optional: Navigate to workshop
    // router.push(`/workspaces/${projectId}/threads/${threadId}/workshop`)
  } catch (error) {
    console.error("Error starting workshop:", error);
    setValidationError(
      error instanceof Error ? error.message : "Failed to start workshop."
    );
  } finally {
    setIsConfirmingWorkshop(false);
  }
};
```

**UI Updates:**
- Error message display (red box above buttons)
- "Start Workshop" button with `onClick={handleStartWorkshop}`
- ConfirmationDialog component at bottom of panel

---

## How the Existing API Works

### Endpoint: `POST /api/workshop/initialize-translations`

**Request Body:**
```typescript
{
  threadId: string;      // UUID of the chat thread
  runInitialTick?: boolean; // Whether to start processing immediately (default: true)
}
```

**Response:**
```typescript
{
  job: TranslationJobState;        // The created translation job
  progress: TranslationJobProgressSummary;
  tickResult?: TranslationTickResult; // Result if runInitialTick was true
}
```

**What it does:**
1. Validates user owns the thread
2. Loads thread context (poem, stanzas, guide answers)
3. Creates a `TranslationJobState` in database
4. If `runInitialTick: true`:
   - Starts processing the first batch of stanzas
   - Calls AI model for translations
   - Stores results in database
5. Returns job status

**Note:** Processing continues in background automatically via:
- Database polling by the frontend
- Scheduled jobs (if configured on backend)
- User interactions that trigger `translation-status` checks

---

## Complete User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   User Opens "Let's Get Started"             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │   User Fills 3 Fields:     │
        │   • Poem                   │
        │   • Translation Zone       │
        │   • Translation Intent     │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  User Clicks "Start        │
        │  Workshop"                 │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────────────────┐
        │  checkGuideComplete() validates fields │
        └────┬──────────────────────────┬────────┘
             │                          │
        ❌ FAIL                      ✅ PASS
             │                          │
             ▼                          ▼
   ┌──────────────────┐  ┌─────────────────────────────┐
   │ Show Error Msg   │  │ Open Confirmation Dialog    │
   │ (red box above   │  │ with summary of settings    │
   │  buttons)        │  └──────────┬──────────────────┘
   └──────────────────┘             │
                                    ▼
                        ┌────────────────────────┐
                        │ User sees dialog with: │
                        │ • Title                │
                        │ • Description          │
                        │ • Confirm/Cancel       │
                        └──┬─────────────────┬───┘
                           │                 │
                    Cancel  │                 │  Confirm
                           │                 │
                           ▼                 ▼
                    ┌──────────────┐  ┌──────────────────┐
                    │ Close Dialog │  │ Loading Spinner  │
                    └──────────────┘  │ (disabled btns)  │
                                      └────────┬─────────┘
                                               │
                                               ▼
                                  ┌────────────────────────────┐
                                  │ POST /api/workshop/        │
                                  │ initialize-translations    │
                                  │ { threadId, runInitialTick}│
                                  └────────┬──────────┬────────┘
                                           │          │
                                       ❌ ERROR   ✅ SUCCESS
                                           │          │
                                           ▼          ▼
                                  ┌──────────────┐  ┌──────────────────┐
                                  │ Show Error   │  │ Close Dialog     │
                                  │ Message      │  │                  │
                                  └──────────────┘  │ Background job   │
                                                    │ starts processing│
                                                    │ all stanzas/lines│
                                                    └──────────────────┘
```

---

## Architecture Diagram

```
GuideRail Component
├── State Variables
│   ├── showConfirmDialog: boolean
│   ├── validationError: string | null
│   └── isConfirmingWorkshop: boolean
│
├── Handlers
│   ├── handleStartWorkshop()
│   │   └─> checkGuideComplete() [from guideSlice]
│   │   └─> if invalid: show error
│   │   └─> if valid: open dialog
│   │
│   └── handleConfirmWorkshop()
│       └─> POST /api/workshop/initialize-translations
│       └─> on success: close dialog
│       └─> on error: show error message
│
└── Render
    ├── Error Message (conditional red box)
    ├── "Start Workshop" Button [onClick: handleStartWorkshop]
    └── ConfirmationDialog
        ├── open: showConfirmDialog
        ├── onConfirm: handleConfirmWorkshop
        └── isLoading: isConfirmingWorkshop
```

---

## Translation Job Processing System

Once `initialize-translations` is called with `runInitialTick: true`, the background system:

### 1. **Job Creation** (`createTranslationJob()`)
- Creates job record with:
  - Stanzas to process (queue)
  - Processing limits (maxConcurrent, maxStanzasPerTick)
  - Guide preferences embedded
  - Full poem for context

### 2. **Initial Tick** (`runTranslationTick()`)
- Loads thread context
- Processes 1-N stanzas based on limits
- For each stanza:
  - Generates translations using AI model
  - Stores results in database
  - Updates job status

### 3. **Continuous Processing**
- Tracked via polling `/api/workshop/translation-status`
- Frontend can display progress
- Job completes when all stanzas processed

### 4. **User Interaction** (Workshop Phase)
- User views completed translations
- Selects variants
- Makes edits
- Saves final versions

---

## Error Handling

### Validation Errors
- Displayed in red box above buttons
- User can fix fields and retry
- Error clears when user starts editing again (optional enhancement)

### API Errors
- Caught in try-catch block
- User-friendly error message displayed
- Loading spinner hidden
- User can retry

### Transient Errors (Backend)
- Automatic retry with exponential backoff
- Rate limiting handled
- Fallback mechanisms

---

## Testing Checklist

- [ ] Fill all 3 fields correctly → "Start Workshop" button works
- [ ] Leave one field empty → Try to click button → See error message
- [ ] Click "Start Workshop" with all fields filled → Confirmation dialog appears
- [ ] Click "Cancel" in dialog → Dialog closes, no API call
- [ ] Click "Start Workshop" in dialog → Loading spinner shows
- [ ] After success → Dialog closes, background processing begins
- [ ] API error scenario → Error message displayed in main panel
- [ ] Retry after error → Works correctly

---

## Next Steps / Future Enhancements

1. **Progress Tracking UI**
   - Display real-time progress of translation job
   - Show which stanzas are being processed
   - Estimate time to completion

2. **Error Recovery UI**
   - Clear error messages with suggested actions
   - Retry buttons for failed stanzas
   - Download processing logs

3. **Navigation**
   - Auto-redirect to workshop when processing starts
   - Or show "Go to Workshop" button

4. **Analytics**
   - Track time from validation to completion
   - Monitor success/failure rates
   - Collect user feedback

---

## File Summary

| File | Change | Status |
|------|--------|--------|
| `src/store/guideSlice.ts` | Added `checkGuideComplete()` method | ✅ Complete |
| `src/components/guide/ConfirmationDialog.tsx` | Created new component | ✅ Complete |
| `src/components/guide/GuideRail.tsx` | Added handlers + integration | ✅ Complete |
| `src/app/api/verification/grade-line/route.ts` | Fixed variable shadowing | ✅ Complete |

---

## Key Takeaways

✅ **Validation** ensures all required fields filled before proceeding
✅ **Confirmation** gives users a chance to review before initiating processing
✅ **Background Processing** leverages existing translation job system
✅ **Error Handling** provides user-friendly feedback at every step
✅ **Async/Await** keeps UI responsive during API calls
✅ **Type Safety** maintained throughout with TypeScript interfaces
