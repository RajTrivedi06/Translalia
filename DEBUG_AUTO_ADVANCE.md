# Debug Auto-Advance Issue

**Purpose**: Comprehensive logging added to debug why auto-advance isn't working after clicking "Confirm Save"

---

## Logging Added

### Component: NotebookPhase6.tsx (handleFinalize function)

**Logs to watch for**:
```
[handleFinalize] START - currentLineIndex: 0
[handleFinalize] Translation: "Mi primera línea traducida"
[handleFinalize] Saving line 0: "Mi primera línea traducida"
[handleFinalize] Updated manuallyFinalizedLines: [0]
[handleFinalize] Calling finalizeCurrentLine()
[handleFinalize] Next line index: 1, Total lines: 10
[handleFinalize] Will navigate to line 1 after delay
[handleFinalize] NOW navigating to line 1
[handleFinalize] navigateToLine() called
```

### Store: notebookSlice.ts (navigateToLine function)

**Logs to watch for**:
```
[notebookSlice.navigateToLine] Called with lineIndex: 1
[notebookSlice.navigateToLine] Current state.currentLineIndex: 0
[notebookSlice.navigateToLine] Current translation: ""
[notebookSlice.navigateToLine] Navigating to 1 without saving draft
```

---

## Testing Instructions

### Step 1: Open Browser Console

1. Start the app: `npm run dev`
2. Open browser (Chrome recommended)
3. Open DevTools: `F12` or `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows)
4. Click **Console** tab
5. Clear console (🚫 icon or `Cmd+K`)

### Step 2: Perform Save Action

1. Go to Notebook phase
2. Drag words to compile Line 1
3. Click **"Save Line (⌘↵)"**
4. Click **"Confirm Save"** in dialog
5. **Watch the console closely**

### Step 3: Analyze Console Output

Look for these key log sequences:

#### ✅ Expected Flow (If Working)
```
[handleFinalize] START - currentLineIndex: 0
[handleFinalize] Translation: "..."
[handleFinalize] Saving line 0: "..."
[handleFinalize] Updated manuallyFinalizedLines: [0]
[handleFinalize] Calling finalizeCurrentLine()
[handleFinalize] Next line index: 1, Total lines: 10
[handleFinalize] Will navigate to line 1 after delay
[handleFinalize] NOW navigating to line 1        ← After 100ms
[handleFinalize] navigateToLine() called
[notebookSlice.navigateToLine] Called with lineIndex: 1  ← Store called
[notebookSlice.navigateToLine] Current state.currentLineIndex: 0
[notebookSlice.navigateToLine] Navigating to 1 without saving draft
```

**Result**: Should see currentLineIndex change from 0 → 1 in UI

#### ❌ Problem Scenario 1: navigateToLine Not Called
```
[handleFinalize] START - currentLineIndex: 0
[handleFinalize] Translation: "..."
[handleFinalize] Saving line 0: "..."
[handleFinalize] Next line index: 1, Total lines: 10
[handleFinalize] Will navigate to line 1 after delay
← MISSING: "NOW navigating" log never appears
```

**Diagnosis**: setTimeout never fires
**Possible Cause**: Component unmounting, dialog preventing execution

#### ❌ Problem Scenario 2: navigateToLine Called But No State Change
```
[handleFinalize] NOW navigating to line 1
[handleFinalize] navigateToLine() called
[notebookSlice.navigateToLine] Called with lineIndex: 1
[notebookSlice.navigateToLine] Current state.currentLineIndex: 0
[notebookSlice.navigateToLine] Navigating to 1 without saving draft
← UI doesn't update, still shows Line 1 of 10
```

**Diagnosis**: State updated but UI not re-rendering
**Possible Cause**: Store subscription issue, React not detecting change

#### ❌ Problem Scenario 3: Wrong Total Lines
```
[handleFinalize] Next line index: 1, Total lines: 1
[handleFinalize] Last line reached (1/1), not navigating
```

**Diagnosis**: `poemLines.length` is wrong
**Possible Cause**: Poem not loaded correctly

---

## What to Report

After testing, copy and paste the **complete console output** showing:

1. All `[handleFinalize]` logs
2. All `[notebookSlice.navigateToLine]` logs
3. Any errors (red text)
4. What the UI shows:
   - Current line number before save
   - Current line number after save
   - Whether "✓ Saved" badge appears

### Example Report Format

```
## Test Results

### Console Output:
```
[paste all console logs here]
```

### UI State:
- Before save: Line 1 of 10
- After save: Line 1 of 10 (expected: Line 2 of 10) ← BUG
- "✓ Saved" badge: YES/NO

### Observed Behavior:
[Describe what happened]

### Expected Behavior:
Should automatically advance from Line 1 to Line 2
```

---

## Common Issues & Solutions

### Issue 1: No Logs Appear

**Problem**: Console is completely empty
**Solution**:
- Check console filter (should show "All levels")
- Try `console.log('test')` in browser console to verify it works
- Refresh page and try again

### Issue 2: Logs Stop at "Will navigate"

**Problem**: Never sees "NOW navigating" log
**Diagnosis**: setTimeout not executing
**Possible Solutions**:
- Dialog might be blocking execution
- Component might unmount during delay
- Try increasing delay: `setTimeout(() => {...}, 500)` instead of 100

### Issue 3: navigateToLine Called But No UI Update

**Problem**: Store function logs show it's called, but UI doesn't change
**Diagnosis**: State update not triggering re-render
**Check**:
- Is `currentLineIndex` being read from the store correctly?
- Run this in console: `useNotebookStore.getState().currentLineIndex`

### Issue 4: currentLineIndex is null

**Problem**: Logs show `currentLineIndex: null`
**Diagnosis**: Notebook not properly initialized
**Check**:
- Did you start from Workshop and go to Notebook?
- Try clicking a line number in the UI first

---

## Quick Diagnostic Commands

Run these in browser console while on Notebook page:

### Check Current State
```javascript
// Get notebook store state
const state = useNotebookStore.getState();
console.log('currentLineIndex:', state.currentLineIndex);
console.log('droppedCells:', state.droppedCells);
console.log('poemLines:', useWorkshopStore.getState().poemLines);
```

### Manually Trigger Navigation
```javascript
// Try navigating manually
useNotebookStore.getState().navigateToLine(2);
```

### Check if Store is Updating
```javascript
// Subscribe to state changes
useNotebookStore.subscribe((state) => {
  console.log('Store updated! currentLineIndex:', state.currentLineIndex);
});
```

---

## Next Steps Based on Results

### If navigateToLine is NOT being called:
→ Problem is in `handleFinalize` function
→ Check if setTimeout is being blocked
→ Try removing `finalizeCurrentLine()` call temporarily

### If navigateToLine IS called but UI doesn't update:
→ Problem is in store or component re-rendering
→ Check if `currentLineIndex` subscription is working
→ Verify component is reading from store correctly

### If logs show correct sequence but wrong behavior:
→ Send me the complete console output
→ Include screenshots of UI before/after

---

## Cleanup (Optional)

Once we fix the issue, we can remove all the `console.log` statements:

**In NotebookPhase6.tsx**: Remove lines 309, 312, 317, 324, 333, 341, 346, 349, 352, 354, 357

**In notebookSlice.ts**: Remove lines 371, 372, 381, 386, 396

---

**Status**: Extensive logging added
**Action Required**: Test and send console output
**Expected Time**: 5 minutes
