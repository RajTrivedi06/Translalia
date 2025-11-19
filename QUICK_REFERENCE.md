# Quick Reference: Implementation Code

## 1️⃣ Validation Method (guideSlice.ts)

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

**Usage:**
```typescript
const isComplete = checkGuideComplete();
if (isComplete) {
  // All fields are filled
}
```

---

## 2️⃣ ConfirmationDialog Component

**Import:**
```typescript
import { ConfirmationDialog } from "@/components/guide/ConfirmationDialog";
```

**Usage:**
```typescript
<ConfirmationDialog
  open={showConfirmDialog}
  onOpenChange={setShowConfirmDialog}
  onConfirm={handleConfirmWorkshop}
  isLoading={isConfirmingWorkshop}
  title="Ready to start the workshop?"
  description="Your poem, translation zone, and translation intent are set. You can make changes anytime."
  confirmText="Start Workshop"
  cancelText="Cancel"
/>
```

**Props:**
```typescript
interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}
```

---

## 3️⃣ Validation Handler

```typescript
const handleStartWorkshop = () => {
  // Validate all fields are complete
  const isComplete = checkGuideComplete();

  if (!isComplete) {
    // Show validation error message
    setValidationError(
      "Please fill in all required fields: Poem, Translation Zone, and Translation Intent"
    );
    return;
  }

  // All fields are valid, show confirmation dialog
  setValidationError(null);
  setShowConfirmDialog(true);
};
```

---

## 4️⃣ Background Processing Handler

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
      throw new Error(
        errorData.error || "Failed to initialize translations"
      );
    }

    // ✅ Success: close dialog and proceed to workshop
    setShowConfirmDialog(false);
    setValidationError(null);

    // Optional: Navigate to workshop
    // router.push(`/workspaces/${projectId}/threads/${threadId}/workshop`)
  } catch (error) {
    console.error("Error starting workshop:", error);
    setValidationError(
      error instanceof Error
        ? error.message
        : "Failed to start workshop. Please try again."
    );
  } finally {
    setIsConfirmingWorkshop(false);
  }
};
```

---

## 5️⃣ UI Integration (GuideRail)

**Import:**
```typescript
import { ConfirmationDialog } from "@/components/guide/ConfirmationDialog";
```

**State:**
```typescript
const [showConfirmDialog, setShowConfirmDialog] = useState(false);
const [validationError, setValidationError] = useState<string | null>(null);
const [isConfirmingWorkshop, setIsConfirmingWorkshop] = useState(false);
```

**Store destructuring:**
```typescript
const { checkGuideComplete } = useGuideStore();
```

**Error Display:**
```typescript
{validationError && (
  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
    {validationError}
  </div>
)}
```

**Button:**
```typescript
<button
  id="start-workshop-btn"
  type="button"
  onClick={handleStartWorkshop}
  className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
>
  Start Workshop
</button>
```

**Dialog:**
```typescript
<ConfirmationDialog
  open={showConfirmDialog}
  onOpenChange={setShowConfirmDialog}
  onConfirm={handleConfirmWorkshop}
  isLoading={isConfirmingWorkshop}
  title="Ready to start the workshop?"
  description="Your poem, translation zone, and translation intent are set. You can make changes anytime. Click 'Start Workshop' to begin translating."
  confirmText="Start Workshop"
  cancelText="Cancel"
/>
```

---

## 6️⃣ API Endpoint

**POST** `/api/workshop/initialize-translations`

**Request:**
```json
{
  "threadId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "runInitialTick": true
}
```

**Success Response (200):**
```json
{
  "job": {
    "jobId": "job-uuid",
    "status": "processing",
    "queue": [1, 2, 3],
    "active": [0],
    "stanzas": {
      "0": {
        "stanzaIndex": 0,
        "status": "processing",
        "linesProcessed": 2,
        "totalLines": 4
      }
    }
  },
  "progress": {
    "completed": 0,
    "processing": 1,
    "queued": 2,
    "failed": 0
  },
  "tickResult": {
    "job": { /* ... */ },
    "startedStanzas": [0],
    "completedStanzas": [],
    "hasWorkRemaining": true
  }
}
```

**Error Response (400/500):**
```json
{
  "error": "Thread not found or unauthorized"
}
```

---

## 7️⃣ Common Patterns

### Check if guide is complete before proceeding
```typescript
if (checkGuideComplete()) {
  // Proceed to workshop
} else {
  // Show error message
}
```

### Call initialization with error handling
```typescript
try {
  const response = await fetch("/api/workshop/initialize-translations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, runInitialTick: true }),
  });

  if (!response.ok) {
    throw new Error("Failed to initialize");
  }

  // Success
} catch (error) {
  // Handle error
}
```

### Show loading state while processing
```typescript
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async () => {
  setIsLoading(true);
  try {
    // Do async work
  } finally {
    setIsLoading(false);
  }
};
```

---

## 8️⃣ State Transitions

```
START
  ↓
showConfirmDialog = false
validationError = null
isConfirmingWorkshop = false
  ↓
User clicks "Start Workshop"
  ↓
Call checkGuideComplete()
  ├─ ❌ INVALID → validationError = "message"
  └─ ✅ VALID → showConfirmDialog = true
  ↓
User sees dialog
  ├─ Clicks Cancel → showConfirmDialog = false
  └─ Clicks Confirm → isConfirmingWorkshop = true
  ↓
API call to initialize-translations
  ├─ ✅ SUCCESS → 
  │     showConfirmDialog = false
  │     validationError = null
  │     Job starts processing
  └─ ❌ ERROR →
        validationError = error message
        showConfirmDialog = false
  ↓
isConfirmingWorkshop = false
END
```

---

## 9️⃣ Environment Setup

No additional environment variables needed. Uses existing:
- `threadId` from `useThreadId()`
- API endpoint at `/api/workshop/initialize-translations`
- Zustand store from `@/store/guideSlice`

---

## 🔟 Type Definitions

**From guideSlice.ts:**
```typescript
interface GuideState {
  // ... other fields
  checkGuideComplete: () => boolean;
}
```

**From ConfirmationDialog.tsx:**
```typescript
interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}
```

**From API response:**
```typescript
interface InitializeTranslationsRequest {
  threadId: string;
  runInitialTick?: boolean;
}

interface InitializeTranslationsResponse {
  job: TranslationJobState;
  progress: TranslationJobProgressSummary;
  tickResult?: TranslationTickResult;
}
```

---

## Files to Review

1. **src/store/guideSlice.ts** - Validation logic
2. **src/components/guide/ConfirmationDialog.tsx** - Dialog component
3. **src/components/guide/GuideRail.tsx** - Integration point
4. **src/lib/workshop/runTranslationTick.ts** - Background processing

---

**Last Updated:** 2024-11-14
**Status:** ✅ Complete
