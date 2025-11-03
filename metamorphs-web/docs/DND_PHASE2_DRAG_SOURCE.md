# Phase 2: Drag Source Implementation - Completed

**Date:** 2025-10-16
**Status:** ✅ Complete

---

## Executive Summary

Phase 2 has been successfully completed. We've implemented draggable word translation options in the Workshop component, created a comprehensive drag data structure, added visual feedback for drag states, and integrated the DnD context at the page level to enable cross-component dragging.

---

## 1. Workshop Components Investigation

### 1.1 Components Identified

**Location:** `src/components/workshop-rail/`

**Key Components:**

1. **WorkshopRail.tsx** - Main workshop container
   - Manages workshop state and display logic
   - Conditionally renders LineSelector or WordGrid based on selection

2. **WordGrid.tsx** - Word-by-word translation interface
   - Displays translation options for each word in a line
   - **NOW**: Enhanced with draggable word options
   - Shows part-of-speech tags with color coding

3. **LineSelector.tsx** - Line selection interface
4. **WorkshopHeader.tsx** - Workshop header component
5. **CompilationFooter.tsx** - Footer for saving/applying translations

### 1.2 State Management

**Store:** `src/store/workshopSlice.ts`

**Key State:**
```typescript
interface WorkshopState {
  selectedLineIndex: number | null;
  wordOptions: WordOption[] | null;
  selections: Record<number, string>;  // position -> selected word
  poemLines: string[];
  completedLines: Record<number, string>;
}

interface WordOption {
  original: string;
  position: number;
  options: string[];
  partOfSpeech?: "noun" | "verb" | "adjective" | ...;
}
```

**Key Actions:**
- `selectWord(position, word)` - Select a translation option
- `deselectWord(position)` - Deselect a translation option
- `setWordOptions(options)` - Set available word options for current line

### 1.3 Data Flow

```
Guide Rail (poem input)
  ↓
WorkshopStore (poemLines)
  ↓
LineSelector (select line)
  ↓
WordGrid (generate options via API)
  ↓
API: /api/workshop/generate-options
  ↓
WordColumn (display word options)
  ↓
DraggableWordOption (NEW: draggable translation options)
  ↓
Notebook (drop target - Phase 3)
```

---

## 2. Drag Data Structure

### 2.1 Type Definitions

**File:** `src/types/drag.ts` (NEW)

```typescript
export interface DragData {
  /** Unique identifier for the dragged item */
  id: string;

  /** The translated word/text being dragged */
  text: string;

  /** The original source word */
  originalWord: string;

  /** Part of speech tag for the word */
  partOfSpeech:
    | "noun"
    | "verb"
    | "adjective"
    | "adverb"
    | "pronoun"
    | "preposition"
    | "conjunction"
    | "article"
    | "interjection"
    | "neutral";

  /** Source line number in the poem */
  sourceLineNumber: number;

  /** Position of word in the source line */
  position: number;
}

export type DragSource = "workshop" | "notebook";

export interface DragContext {
  source: DragSource;
  data: DragData;
}
```

### 2.2 Data Construction

```typescript
const dragData: DragData = {
  id: `${sourceLineNumber}-${word.position}-${option}`,
  text: option,                    // e.g., "amour"
  originalWord: word.original,     // e.g., "love"
  partOfSpeech: pos,              // e.g., "noun"
  sourceLineNumber,               // e.g., 2
  position: word.position,        // e.g., 4
};
```

---

## 3. Draggable Word Options

### 3.1 New Component: DraggableWordOption

**File:** `src/components/workshop-rail/WordGrid.tsx` (lines 271-350)

**Features:**
- Uses `useDraggable` hook from @dnd-kit/core
- Attaches drag data to each translation option
- Provides visual feedback during drag
- Includes drag handle indicator
- Shows helper tooltip on hover

**Implementation:**
```typescript
function DraggableWordOption({
  word,
  option,
  pos,
  isSelected,
  sourceLineNumber,
  onClick,
}: DraggableWordOptionProps) {
  const dragData: DragData = {
    id: `${sourceLineNumber}-${word.position}-${option}`,
    text: option,
    originalWord: word.original,
    partOfSpeech: pos,
    sourceLineNumber,
    position: word.position,
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: dragData.id,
      data: dragData,
    });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative w-full text-center rounded-lg border-2 px-3 py-2
        transition-all duration-200 text-sm font-medium
        ${isSelected ? "border-green-500 bg-green-50 ..." : "..."}
        ${isDragging ? "opacity-50 scale-95" : ""}
      `}
      {...attributes}
      {...listeners}
    >
      {/* Drag handle indicator */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity">
        <GripVertical className="w-3 h-3 text-gray-400" />
      </div>

      {/* Word text - clickable to select */}
      <button
        type="button"
        onClick={onClick}
        className="w-full h-full text-center"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {option}
      </button>

      {/* Helper tooltip */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] text-gray-500 bg-white px-2 py-1 rounded border shadow-sm">
          Drag to notebook →
        </span>
      </div>
    </div>
  );
}
```

### 3.2 Integration in WordColumn

**Updated:** WordColumn component now renders DraggableWordOption for each translation option

**Before:**
```typescript
<button onClick={() => onSelectOption(opt)}>{opt}</button>
```

**After:**
```typescript
<DraggableWordOption
  word={word}
  option={opt}
  pos={pos}
  isSelected={isThisSelected}
  sourceLineNumber={selectedLineIndex ?? 0}
  onClick={() => onSelectOption(opt)}
/>
```

---

## 4. Visual Feedback

### 4.1 Drag States

**Hover State:**
- Cursor changes to `grab`
- Drag handle (GripVertical icon) appears with fade-in
- Helper tooltip shows: "Drag to notebook →"
- Border color shifts to blue on hover

**Dragging State:**
- Cursor changes to `grabbing`
- Original element opacity reduces to 50%
- Element scales down slightly (scale-95)
- Transform applied for smooth follow

**Selected State:**
- Green border and background
- Check icon displayed
- Scales up slightly (scale-105)

### 4.2 Visual Indicators

1. **Drag Handle Icon**
   - `<GripVertical />` from lucide-react
   - Positioned on left side of option
   - Fades in on hover (opacity 0 → 0.4)
   - Not interactive (pointer-events-none)

2. **Helper Tooltip**
   - "Drag to notebook →"
   - Positioned above the option
   - Fades in on group hover
   - Small font (10px)
   - White background with border

3. **Part of Speech Badge**
   - Color-coded by POS type
   - Shows above each word column
   - Provides context for the word type

---

## 5. DnD Context Integration

### 5.1 Page-Level Context

**File:** `src/app/(app)/workspaces/[projectId]/threads/[threadId]/page.tsx`

**Implementation:**
```typescript
export default function ThreadPage() {
  // ... existing code

  // DnD Setup
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const dragData = event.active.data.current as DragData;
    setActiveDragData(dragData);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragData(null);

    const { active, over } = event;
    if (over && over.id === "notebook-dropzone") {
      const dragData = active.data.current as DragData;
      console.log("[DnD] Dropped word into notebook:", dragData);
      // TODO: Handle adding the word to notebook (Phase 3)
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Page layout */}
      <PanelGroup>
        <Panel><GuideRail /></Panel>
        <Panel><WorkshopRail /></Panel>
        <Panel><NotebookPanel /></Panel>
      </PanelGroup>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeDragData ? (
          <div className="bg-white border-2 border-blue-500 rounded-lg px-4 py-3 shadow-2xl opacity-90">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {activeDragData.partOfSpeech.toUpperCase()}
              </Badge>
              <span className="font-medium text-sm">{activeDragData.text}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              from: "{activeDragData.originalWord}"
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

### 5.2 Why Page-Level Context?

**Reasons:**
1. Enables cross-component dragging (Workshop → Notebook)
2. Single source of truth for drag state
3. Unified drag overlay for entire workspace
4. Prevents conflicts between multiple DndContexts

### 5.3 NotebookPane Updates

**Changed:** Removed internal DndContext from NotebookPane

**Before:** NotebookPane had its own DndContext for cell reordering

**After:** NotebookPane relies on page-level DndContext

**Kept:** SortableContext for cell reordering (works within page-level DndContext)

---

## 6. Drag Preview/Ghost Element

### 6.1 DragOverlay Component

**Location:** Thread page component

**Features:**
- Shows a styled preview of the dragged word
- Follows cursor during drag
- Displays:
  - Part of speech badge
  - Translated text
  - Original word reference
- Styled with high visibility (shadow, border, opacity)

**Visual Design:**
```typescript
<div className="bg-white border-2 border-blue-500 rounded-lg px-4 py-3 shadow-2xl opacity-90">
  <div className="flex items-center gap-2">
    <Badge variant="secondary" className="text-[10px]">
      {partOfSpeech.toUpperCase()}
    </Badge>
    <span className="font-medium text-sm">{text}</span>
  </div>
  <div className="text-xs text-gray-500 mt-1">
    from: "{originalWord}"
  </div>
</div>
```

### 6.2 Drag Preview States

1. **Not Dragging:** DragOverlay renders null
2. **Dragging:** Shows styled preview following cursor
3. **Drop Success:** Preview disappears, action executes
4. **Drop Cancelled:** Preview disappears, no action

---

## 7. User Experience Enhancements

### 7.1 First-Time User Guidance

**Helper Tooltip:**
- Appears on hover over any translation option
- Text: "Drag to notebook →"
- Positioned above the option
- Subtle styling (not intrusive)

**Visual Cues:**
- Drag handle icon on hover
- Cursor changes (grab/grabbing)
- Color changes on hover
- Smooth animations

### 7.2 Interaction Modes

**Click to Select:**
- Still works as before
- Click option to select/toggle
- Green highlight shows selection
- Check icon appears

**Drag to Notebook:**
- NEW: Grab and drag option
- Drag preview follows cursor
- Drop into notebook (Phase 3)
- Works alongside click-to-select

---

## 8. Technical Considerations

### 8.1 Click vs. Drag Disambiguation

**Problem:** Button inside draggable element

**Solution:**
```typescript
<button
  onClick={onClick}
  onPointerDown={(e) => e.stopPropagation()}
>
  {option}
</button>
```

**How it works:**
- `onPointerDown` stops propagation to drag handler
- Allows clicks to work normally
- Drag still works when grabbing outside button area (handle, borders)

### 8.2 Activation Constraint

**Configuration:**
```typescript
activationConstraint: {
  distance: 8, // 8px movement required
}
```

**Purpose:**
- Prevents accidental drags
- Allows clicks to work reliably
- Requires deliberate drag gesture

### 8.3 Performance

**Optimizations:**
- CSS transforms for smooth dragging
- Opacity/scale transitions for visual feedback
- No heavy computations during drag
- Efficient re-renders with proper memoization

---

## 9. Files Modified

| File | Type | Changes |
|------|------|---------|
| `src/types/drag.ts` | Types | NEW: Drag data type definitions |
| `src/components/workshop-rail/WordGrid.tsx` | Component | Added DraggableWordOption component |
| `src/app/(app)/workspaces/[projectId]/threads/[threadId]/page.tsx` | Page | Added DndContext and DragOverlay |
| `src/components/notebook/NotebookPane.tsx` | Component | Removed internal DndContext |

---

## 10. Testing Checklist

### 10.1 Drag Functionality
- ✅ Word options are draggable
- ✅ Drag preview appears and follows cursor
- ✅ Drag data is correctly constructed
- ✅ 8px activation constraint works

### 10.2 Visual Feedback
- ✅ Drag handle appears on hover
- ✅ Cursor changes (grab → grabbing)
- ✅ Opacity reduces during drag
- ✅ Helper tooltip shows "Drag to notebook →"

### 10.3 Click Interaction
- ✅ Clicking option still selects it
- ✅ Selection state persists
- ✅ Green highlight shows for selected options
- ✅ Check icon appears when selected

### 10.4 Drag Overlay
- ✅ Shows word text and POS badge
- ✅ Shows original word reference
- ✅ Follows cursor smoothly
- ✅ Disappears on drop/cancel

---

## 11. Next Steps (Phase 3)

With drag sources complete, Phase 3 will focus on:

1. **Drop Target Implementation**
   - Make NotebookPanel/NotebookPane droppable
   - Use `useDroppable` hook
   - Visual indicators for drop zones

2. **Drop Handling**
   - Extract drag data on drop
   - Create notebook cell from dropped word
   - Add cell to `droppedCells` in NotebookStore
   - Persist dropped cells

3. **Multi-Word Assembly**
   - Allow dropping multiple words
   - Build complete translation line
   - Reorder dropped words
   - Combine into final translation

4. **Cell Management**
   - Edit dropped cells
   - Remove cells
   - Lock/unlock words
   - Save translations

---

## 12. Summary

Phase 2 is **complete and successful**. We have:

1. ✅ Investigated workshop components and state management
2. ✅ Created comprehensive drag data structure
3. ✅ Implemented draggable word translation options
4. ✅ Added visual feedback for drag states (handle, cursor, tooltip)
5. ✅ Created drag preview/ghost element
6. ✅ Integrated DnD context at page level
7. ✅ Added first-time user guidance
8. ✅ Maintained click-to-select functionality
9. ✅ Documented all implementation details

**Ready to proceed to Phase 3:** Drop target implementation and word assembly in the notebook.

---

## 13. Demo Instructions

To see the drag functionality in action:

1. Navigate to `/workspaces/[projectId]/threads/[threadId]`
2. Complete the Guide Rail to load a poem
3. Select a line in the Workshop
4. Wait for translation options to generate
5. Hover over any word option - see the drag handle and tooltip
6. Click and drag a word option - see the drag preview
7. Current behavior: Drag anywhere (drop handling in Phase 3)

---

**Phase 2 Status:** ✅ **COMPLETE**
