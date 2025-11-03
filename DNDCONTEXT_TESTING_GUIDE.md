# DndContext Testing & Verification Guide
## Step-by-Step Instructions for Testing Cross-Panel Drag-Drop

---

## Pre-Testing Checklist

- [ ] App is running: `npm run dev`
- [ ] Browser DevTools open (F12)
- [ ] Console tab visible
- [ ] Guide Rail filled out (poem loaded)
- [ ] Workshop shows word options
- [ ] Notebook drop zone visible

---

## Test 1: Basic Drag Visualization

### Objective
Verify that DragOverlay appears when dragging word options.

### Steps
1. **Locate a word option** in the Workshop panel (middle section)
2. **Start dragging** any word option (click and hold)
3. **Observe**:
   - [ ] A card appears under cursor (DragOverlay)
   - [ ] Card shows word text in blue badge
   - [ ] Card shows "from: [original word]" in gray text
   - [ ] Card follows cursor smoothly
4. **Release without dropping** over notebook
   - [ ] Card disappears
   - [ ] No cell created
   - [ ] No console errors

### Expected Result
```
DragOverlay shows:
┌─────────────────────────────┐
│ [VERB] love                 │
│ from: "amar"                │
└─────────────────────────────┘
```

### Debug Points
If DragOverlay doesn't appear:
```typescript
// Add to ThreadPageClient.tsx handleDragStart:
console.log('[ThreadPageClient] Drag Start:', {
  draggableId: event.active.id,
  dragType: dragData?.dragType,
  hasData: !!dragData,
});
```

---

## Test 2: Drop Zone Highlighting

### Objective
Verify that NotebookDropZone highlights when hovering with dragged word.

### Steps
1. **Start dragging** a word option (same as Test 1)
2. **Hover cursor** over the Notebook drop zone (right panel)
3. **Observe**:
   - [ ] Drop zone border changes to blue
   - [ ] Background tint becomes light blue
   - [ ] Shadow appears on drop zone
   - [ ] "Drop here!" text appears (if empty)
4. **Move cursor back** to Workshop area
   - [ ] Drop zone returns to normal gray border
   - [ ] Blue highlight disappears
5. **Drag back over** drop zone
   - [ ] Highlight reappears immediately

### Expected CSS Classes Applied
```
When isOver=true:
- border-blue-500 (blue border)
- bg-blue-50/70 (light blue background)
- shadow-lg (drop shadow)

When isOver=false:
- border-gray-300 (gray border)
- bg-white (white background)
- no shadow
```

### Debug Points
If highlighting doesn't work:
```typescript
// Add to NotebookDropZone.tsx useDroppable:
React.useEffect(() => {
  console.log('[NotebookDropZone] isOver:', isOver);
}, [isOver]);

// Check rendered class:
console.log('Applied className:', dropStateClass);
```

---

## Test 3: Successful Drop & Cell Creation

### Objective
Verify that dropping a word creates a cell in the notebook.

### Steps
1. **Select a line** in Workshop (click "Line N")
   - [ ] Word grid appears with options
2. **Drag a word option** to Notebook drop zone
3. **Release mouse** over the drop zone
4. **Observe Notebook**:
   - [ ] New cell appears with the dragged word
   - [ ] Cell shows the word text
   - [ ] Part-of-speech badge visible
   - [ ] Cell has lock/edit/delete buttons
5. **Check console**:
   - [ ] No errors
   - [ ] Drag end handler logs should appear

### Expected Cell Structure
```
┌─────────────────────────┐
│ [VERB] love             │
│ Original: "amar"        │
└─────────────────────────┘
(with Lock, Edit, Delete buttons)
```

### Debug Points
If cell isn't created:
```typescript
// Add to handleDragEnd:
console.log('[ThreadPageClient] Drag End:', {
  hasOver: !!over,
  overIdMatches: over?.id === "notebook-dropzone",
  dragDataPresent: !!active.data.current,
});

// Check cell creation:
const newCell = createCellFromDragData(dragData);
console.log('[ThreadPageClient] Created cell:', newCell);
```

---

## Test 4: Multiple Drops

### Objective
Verify that multiple words can be dropped in sequence.

### Steps
1. **Drop first word** (from Test 3)
   - [ ] Cell appears
2. **Go back to Workshop** (click "Change Line" or similar)
3. **Select same line again**
   - [ ] Word options reappear
4. **Drag different word option**
5. **Drop in Notebook**
   - [ ] Second cell appears
   - [ ] First cell still present
   - [ ] Two cells now visible
6. **Repeat** for 3-4 more words
   - [ ] Multiple cells accumulate
   - [ ] All cells have correct text
   - [ ] No duplicates

### Expected Result
```
Notebook with multiple cells:
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ love         │ │ is           │ │ eternal      │
│ [VERB]       │ │ [VERB]       │ │ [ADJ]        │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Debug Points
```typescript
// Track cell additions:
const addCell = useNotebookStore((s) => s.addCell);
const originalAddCell = addCell;
// Wrap with logging:
const wrappedAddCell = (cell) => {
  console.log('[Notebook] Adding cell:', cell);
  originalAddCell(cell);
};
```

---

## Test 5: DragData Integrity

### Objective
Verify that DragData properties are correctly transferred.

### Steps
1. **Inspect WordGrid component**
   - Open DevTools: Elements tab
   - Find WordGrid section
   - Check data attributes

2. **Add logging to DraggableWordOption**
   ```typescript
   // In WordGrid.tsx, DraggableWordOption function:
   console.log('[DraggableWordOption] Mounting:', {
     original,
     position,
     option,
     partOfSpeech,
   });
   ```

3. **Drag different word options** and check console
   - [ ] original value correct
   - [ ] position matches word position in line
   - [ ] option text matches displayed text
   - [ ] partOfSpeech is defined

4. **Drop and check created cell**
   - [ ] Cell.translation.text === dragged option
   - [ ] Cell metadata.position === dragged position

### Expected Console Output
```
[DraggableWordOption] Mounting: {
  original: "amor",
  position: 3,
  option: "love",
  partOfSpeech: "NOUN"
}

[ThreadPageClient] Drag Start: {
  dragType: "option",
  text: "love",
  originalWord: "amor",
  position: 3
}

[ThreadPageClient] Drag End: {
  draggableId: "word-xyz-love",
  droppableId: "notebook-dropzone",
  dragType: "option"
}
```

---

## Test 6: Error Scenarios

### Scenario A: Drop outside drop zone
**Steps**:
1. Drag word option
2. Move cursor to Chat panel or other area
3. Release mouse

**Expected**:
- [ ] No error in console
- [ ] No cell created
- [ ] Drag state resets cleanly

**Debug**:
```typescript
// In handleDragEnd, check event.over:
if (!over) {
  console.warn('[ThreadPageClient] Drop outside valid zone');
}
```

### Scenario B: Drag from invalid source
**Steps**:
1. Try to drag from Workshop header/footer (not a word option)
2. Drag over notebook

**Expected**:
- [ ] No drag occurs
- [ ] Or drag occurs but dragData is undefined
- [ ] No cell created on drop

**Debug**:
```typescript
// In createCellFromDragData:
if (!dragData) {
  console.error('[cellHelpers] No dragData provided');
  return undefined;
}
```

### Scenario C: Rapid consecutive drops
**Steps**:
1. Quickly drag and drop 5 words in succession
2. Drop each without waiting

**Expected**:
- [ ] All 5 cells created
- [ ] No race conditions
- [ ] State remains consistent
- [ ] No duplicate cells

---

## Test 7: Component Re-renders

### Objective
Verify that drag state doesn't cause excessive re-renders.

### Steps
1. **Add React DevTools Profiler**
   - Install: [React DevTools Chrome Extension](https://chrome.google.com/webstore/detail/react-developer-tools/)

2. **Open Profiler tab** in DevTools
3. **Start recording**
4. **Perform one complete drag-drop operation**
5. **Stop recording**

**Check**:
- [ ] ThreadPageClient: 1 render on dragStart, 1 on dragEnd
- [ ] NotebookDropZone: re-renders only when isOver changes
- [ ] WorkshopRail: no re-renders during drag
- [ ] GuideRail: no re-renders during drag

**Expected Pattern**:
```
ThreadPageClient mount
├─ dragStart → re-render (activeDragData set)
├─ (mouse move) → no re-renders
└─ dragEnd → re-render (activeDragData cleared, cell added)

NotebookDropZone mount
├─ dragStart → re-render (isOver changes)
├─ (mouse move) → re-render (isOver stays true)
└─ dragEnd → re-render (isOver changes)
```

---

## Test 8: Cross-Browser Compatibility

### Objective
Verify drag-drop works across different browsers.

### Steps
1. **Test in Chrome**
   - [ ] All tests pass

2. **Test in Firefox**
   - [ ] All tests pass
   - [ ] DragOverlay renders correctly
   - [ ] Cursor feedback works

3. **Test in Safari**
   - [ ] Basic drag works
   - [ ] May have limited pointer feedback

4. **Test on Mobile** (if applicable)
   - [ ] Touch drag registered
   - [ ] Drop works with touch release

---

## Performance Testing

### Objective
Verify DnD doesn't impact app performance.

### Test: Large Word Grid
1. **Create line with 100+ words** (if possible)
2. **Drag options**
   - [ ] No lag
   - [ ] DragOverlay smooth
   - [ ] Frame rate stays 60fps

**Measure**:
```typescript
// In handleDragEnd:
const start = performance.now();
// ... handle drop
const end = performance.now();
console.log(`Drag end handler: ${end - start}ms`);
```

Expected: < 50ms

### Test: Multiple Panels
1. **Expand all panels** (GuideRail + Workshop + Notebook)
2. **Drag options**
   - [ ] Smooth across all panels
   - [ ] No jank when crossing resize handles

---

## Cleanup Verification

### After All Tests
1. **Clear cache**
   - [ ] Chrome DevTools → Application → Clear all

2. **Refresh page**
   - [ ] App loads correctly
   - [ ] Drag-drop still works

3. **Check localStorage**
   - [ ] Workshop state persisted correctly
   - [ ] Notebook cells persisted

4. **Verify no console errors**
   - [ ] No "DndContext" errors
   - [ ] No "useDroppable" errors
   - [ ] No "useDraggable" errors

---

## Debugging Toolkit

### Console Commands for Testing

```javascript
// Check if DndContext is active
localStorage.setItem('DEBUG_DND', 'true');

// Log all drag operations
window.addEventListener('dragstart', (e) => {
  console.log('Native dragstart:', e);
});

// Monitor Zustand store changes
import { useNotebookStore } from '@/store/notebookSlice';
const unsubscribe = useNotebookStore.subscribe(
  (state) => console.log('[Zustand] Cell change:', state.droppedCells)
);

// Check active draggable
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('[data-index]')) {
    console.log('Dragging element:', e.target);
  }
});
```

### Visual Debugging

```typescript
// Add temporary visual feedback in WorkshopRail:
<div style={{
  position: 'fixed',
  top: 10,
  right: 10,
  zIndex: 1000,
  background: 'white',
  border: '1px solid black',
  padding: '10px',
  fontSize: '12px',
}}>
  Drag Debug: isDragging={isDragActive}
</div>
```

---

## Troubleshooting

### Issue: DragOverlay doesn't appear
**Checklist**:
- [ ] DndContext is wrapping everything?
- [ ] handleDragStart is setting activeDragData?
- [ ] DragOverlay component is rendered?
- [ ] CSS z-index sufficient?

**Fix**:
```typescript
// Ensure DragOverlay is rendered at root level
// and z-index is high enough
<DragOverlay zIndex={9999}>
  {activeDragData ? <YourOverlay /> : null}
</DragOverlay>
```

### Issue: Drop detection fails
**Checklist**:
- [ ] NotebookDropZone has id="notebook-dropzone"?
- [ ] handleDragEnd checks over?.id?
- [ ] event.over is not null?

**Fix**:
```typescript
// Log to verify drop zone is registered
const { isOver, setNodeRef } = useDroppable({
  id: "notebook-dropzone",
});
console.log('[NotebookDropZone] Registered:', {
  hasNodeRef: !!setNodeRef,
  isOverValue: isOver,
});
```

### Issue: Cell created but data missing
**Checklist**:
- [ ] DragData has all required fields?
- [ ] createCellFromDragData handles all fields?
- [ ] Cell data passed to addCell correctly?

**Fix**:
```typescript
// Validate drag data before creating cell
const dragData = active.data.current as DragData;
if (!dragData || !dragData.text) {
  console.error('Invalid DragData:', dragData);
  return;
}
```

---

## Success Criteria

### All Tests Pass When:
- [ ] ✅ DragOverlay appears on drag start
- [ ] ✅ Drop zone highlights on hover
- [ ] ✅ Cell created on drop over zone
- [ ] ✅ Multiple cells can be dropped
- [ ] ✅ DragData integrity maintained
- [ ] ✅ No console errors
- [ ] ✅ Smooth 60fps performance
- [ ] ✅ State persists across refresh
- [ ] ✅ Works across browsers

### Ready for Production When:
- [ ] All tests pass
- [ ] No memory leaks detected
- [ ] Performance benchmarks met
- [ ] User testing confirms UX
- [ ] Accessibility verified (keyboard navigation)

---

## Next Steps

If all tests pass:
1. ✅ Confirm DndContext architecture is working
2. ✅ Plan additional drag features (source text dragging)
3. ✅ Consider performance optimizations (virtualization)
4. ✅ Add mobile touch support (if needed)

If tests fail:
1. Check DndContext wrapping (single context required)
2. Verify useDraggable/useDroppable hooks properly used
3. Check event.over and event.active in handleDragEnd
4. Review browser console for dnd-kit errors

---

**Testing Date**: ________________
**Tester**: ________________
**Status**: [ ] All Pass [ ] Some Fail [ ] Need Investigation

---

*Document Version: 1.0*
*Last Updated: 2025-10-26*
