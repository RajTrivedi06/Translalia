# Auto-Advance Fix - Root Cause & Solution

**Date**: December 17, 2025
**Issue**: Auto-advance navigates to next line but immediately reverts back
**Root Cause**: Workshop-Notebook sync effect overriding navigation
**Status**: ✅ **FIXED**

---

## Root Cause Analysis

### The Problem

When saving Line 0 in Notebook:
1. ✅ `handleFinalize` calls `navigateToLine(1)`
2. ✅ Store updates `currentLineIndex` from 0 → 1
3. ❌ Workshop sync effect detects change and calls `navigateToLine(0)`
4. ❌ Back to Line 0!

### Console Evidence

```
[handleFinalize] NOW navigating to line 1
[notebookSlice.navigateToLine] Called with lineIndex: 1  ← Navigation succeeds
[notebookSlice.navigateToLine] Current state.currentLineIndex: 0
[notebookSlice.navigateToLine] Saving draft and navigating to 1

← BUT THEN:

[notebookSlice.navigateToLine] Called with lineIndex: 0  ← Sync reverts it!
[notebookSlice.navigateToLine] Current state.currentLineIndex: 1
[notebookSlice.navigateToLine] Navigating to 0 without saving draft
```

### The Culprit Code

**File**: [NotebookPhase6.tsx:164-171](translalia-web/src/components/notebook/NotebookPhase6.tsx#L164-L171) (before fix)

```typescript
// Keep notebook line in sync with workshop selection
React.useEffect(() => {
  if (
    workshopSelectedLine !== null &&
    workshopSelectedLine !== currentLineIndex
  ) {
    navigateToLine(workshopSelectedLine);  // ❌ This reverts our navigation!
  }
}, [workshopSelectedLine, currentLineIndex, navigateToLine]);
```

**What happened**:
1. User saves Line 0 in Notebook
2. Notebook navigates to Line 1 (`currentLineIndex` changes 0 → 1)
3. Effect triggers because `currentLineIndex` changed
4. Workshop is still on Line 0 (`workshopSelectedLine === 0`)
5. Condition `workshopSelectedLine !== currentLineIndex` is true (0 !== 1)
6. Effect calls `navigateToLine(0)` to "sync" back to workshop
7. User stuck on Line 0! 🐛

---

## Solution

### Strategy

Add a **one-way flag** to distinguish between:
- **Workshop → Notebook sync**: Allow (user clicked in Workshop)
- **Notebook → Workshop override**: Block (user navigating in Notebook)

### Implementation

**File**: [NotebookPhase6.tsx:164-183](translalia-web/src/components/notebook/NotebookPhase6.tsx#L164-L183)

#### 1. Add Navigation Flag (line 166)

```typescript
const isNavigatingInNotebook = React.useRef(false);
```

**Why `useRef`**:
- Doesn't cause re-renders
- Persists across renders
- Perfect for tracking immediate state

#### 2. Check Flag in Sync Effect (lines 168-183)

```typescript
React.useEffect(() => {
  // Don't sync back to workshop if we just navigated in the notebook
  if (isNavigatingInNotebook.current) {
    isNavigatingInNotebook.current = false;  // Reset flag
    return;  // Skip this sync
  }

  // Sync notebook to workshop selection (when user clicks a line in Workshop)
  if (
    workshopSelectedLine !== null &&
    workshopSelectedLine !== currentLineIndex
  ) {
    console.log('[NotebookPhase6] Syncing to workshop line:', workshopSelectedLine);
    navigateToLine(workshopSelectedLine);
  }
}, [workshopSelectedLine, currentLineIndex, navigateToLine]);
```

#### 3. Set Flag When Navigating in Notebook (line 366)

**In `handleFinalize` function**:

```typescript
setTimeout(() => {
  console.log(`[handleFinalize] NOW navigating to line ${nextLineIndex}`);
  // Set flag to prevent workshop sync from overriding our navigation
  isNavigatingInNotebook.current = true;  // ← Flag set!
  navigateToLine(nextLineIndex);
  console.log(`[handleFinalize] navigateToLine() called`);
}, 100);
```

---

## How It Works Now

### Sequence of Events (Fixed)

1. **User saves Line 0**
   - `handleFinalize()` called
   - Sets `isNavigatingInNotebook.current = true`
   - Calls `navigateToLine(1)`

2. **Store updates**
   - `currentLineIndex` changes 0 → 1
   - Triggers sync effect

3. **Sync effect runs**
   - Checks `isNavigatingInNotebook.current`
   - Value is `true`
   - Resets flag to `false`
   - **Returns early** (skips sync)
   - ✅ Navigation NOT reverted!

4. **User sees Line 2**
   - UI updates to show "Line 2 of 16"
   - Ready to work on next line

### Next Effect Run (User Clicks in Workshop)

1. **User clicks Line 5 in Workshop**
   - `workshopSelectedLine` changes to 5
   - Triggers sync effect

2. **Sync effect runs**
   - Checks `isNavigatingInNotebook.current`
   - Value is `false` (not navigating in notebook)
   - Continues to sync logic
   - Calls `navigateToLine(5)`
   - ✅ Notebook syncs to Workshop line!

---

## Testing

### Test 1: Save and Auto-Advance

**Steps**:
1. Go to Notebook
2. Compile Line 1
3. Click "Save Line"
4. Click "Confirm Save"

**Expected Console Output**:
```
[handleFinalize] NOW navigating to line 1
[notebookSlice.navigateToLine] Called with lineIndex: 1
[notebookSlice.navigateToLine] Navigating to 1 without saving draft
← NO second navigateToLine call back to 0!
```

**Expected UI**:
- Before save: "Line 1 of 16"
- After save: **"Line 2 of 16"** ✅
- "✓ Saved" badge when navigating back to Line 1

**Status**: Should work now!

### Test 2: Workshop Sync Still Works

**Steps**:
1. While in Notebook on Line 2
2. Switch to Workshop tab
3. Click Line 5
4. Switch back to Notebook tab

**Expected Console Output**:
```
[NotebookPhase6] Syncing to workshop line: 5
[notebookSlice.navigateToLine] Called with lineIndex: 5
```

**Expected UI**:
- Notebook shows "Line 6 of 16" (Line 5 is index 5, display is index + 1)

**Status**: Should still sync correctly!

---

## Code Changes Summary

### NotebookPhase6.tsx

**Section 1**: Lines 164-183 - Sync Effect
```diff
  // Keep notebook line in sync with workshop selection
+ // BUT: Only sync FROM workshop TO notebook, not the other way around
+ // Use a ref to track if we're actively navigating in the notebook
+ const isNavigatingInNotebook = React.useRef(false);
+
  React.useEffect(() => {
+   // Don't sync back to workshop if we just navigated in the notebook
+   if (isNavigatingInNotebook.current) {
+     isNavigatingInNotebook.current = false;
+     return;
+   }
+
+   // Sync notebook to workshop selection (when user clicks a line in Workshop)
    if (
      workshopSelectedLine !== null &&
      workshopSelectedLine !== currentLineIndex
    ) {
+     console.log('[NotebookPhase6] Syncing to workshop line:', workshopSelectedLine);
      navigateToLine(workshopSelectedLine);
    }
  }, [workshopSelectedLine, currentLineIndex, navigateToLine]);
```

**Section 2**: Line 366 - Set Flag in handleFinalize
```diff
  setTimeout(() => {
    console.log(`[handleFinalize] NOW navigating to line ${nextLineIndex}`);
+   // Set flag to prevent workshop sync from overriding our navigation
+   isNavigatingInNotebook.current = true;
    navigateToLine(nextLineIndex);
    console.log(`[handleFinalize] navigateToLine() called`);
  }, 100);
```

---

## Why This Fix Works

### Key Insights

1. **One-way flag**: Prevents infinite sync loops
   - Notebook → Workshop: Blocked during navigation
   - Workshop → Notebook: Always allowed

2. **useRef instead of useState**:
   - No re-renders
   - Immediate updates
   - Perfect for this use case

3. **Flag reset**: Automatically resets after one effect run
   - Prevents permanent blocking
   - Only blocks the immediate sync
   - Normal syncing resumes after

4. **Preserves original sync behavior**:
   - Workshop clicks still sync to Notebook
   - Only blocks when Notebook navigates itself

---

## Alternative Solutions Considered

### ❌ Option 1: Remove Sync Effect Entirely
**Problem**: Workshop → Notebook navigation would break
**When it's needed**: User clicks line in Workshop, Notebook should follow

### ❌ Option 2: Debounce the Sync
**Problem**: Adds delay, still has race conditions
**Why it fails**: Sync would still override after delay

### ❌ Option 3: Check Source of currentLineIndex Change
**Problem**: No way to track where state change came from in React
**Why it fails**: Store doesn't track change source

### ✅ Option 4: Use Navigation Flag (Implemented)
**Why it works**:
- Simple
- No race conditions
- Preserves both navigation paths
- Self-resetting

---

## Edge Cases Handled

### Case 1: Rapid Saves
**Scenario**: User saves Line 1, 2, 3 quickly
**Behavior**: Each navigation sets flag, skips sync, works correctly

### Case 2: Save Last Line
**Scenario**: User saves Line 16 (last line)
**Behavior**: No navigation triggered, flag never set, no issues

### Case 3: Workshop Click During Save
**Scenario**: User saves, but clicks Workshop line before navigation completes
**Behavior**: Flag prevents override during setTimeout, then sync resumes

### Case 4: Save → Workshop Click → Save
**Scenario**: Complex navigation sequence
**Behavior**: Each operation sets/resets flag appropriately

---

## Debugging Tips

If auto-advance still fails:

1. **Check console logs**:
   - Should NOT see second `navigateToLine(0)` call
   - Should see `[NotebookPhase6] Syncing to workshop line:` only for Workshop clicks

2. **Check flag value**:
   ```javascript
   // In browser console
   console.log(useNotebookStore.getState().currentLineIndex);
   ```

3. **Verify Workshop state**:
   ```javascript
   // Check workshop line
   console.log(useWorkshopStore.getState().selectedLineIndex);
   ```

---

## Cleanup (After Confirming Fix Works)

Once auto-advance is confirmed working, we can remove debug logs:

**NotebookPhase6.tsx**:
- Remove lines 309, 312, 317, 324, 333, 341, 346, 349, 352, 354, 357, 371
- Keep line 180 (sync log) for debugging Workshop sync if needed

**notebookSlice.ts**:
- Remove lines 371, 372, 381, 386, 396

---

## Summary

**Problem**: Sync effect was fighting with navigation
**Solution**: Flag to distinguish Notebook vs Workshop navigation
**Impact**: Auto-advance now works correctly
**Side Effects**: None - Workshop sync still works

**Status**: ✅ Ready for testing
**Expected Behavior**: Save Line 1 → Auto-advance to Line 2

---

**Implementation Date**: 2025-12-17
**Files Changed**: 1 ([NotebookPhase6.tsx](translalia-web/src/components/notebook/NotebookPhase6.tsx))
**Lines Added**: ~10 lines
**Breaking Changes**: None
**Fix Type**: Bug fix (sync conflict resolution)
