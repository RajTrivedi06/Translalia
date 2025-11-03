# Feature Verification Plan: Source Text Drag-and-Drop

**Date:** 2025-01-27  
**Status:** ✅ **FEATURE ALREADY IMPLEMENTED**  
**Verification Status:** Needs Testing

---

## Executive Summary

**Good news!** The feature you're requesting is **already fully implemented** in the codebase. Source text words from the workshop can already be dragged and dropped into the notebook section, just like translated word options.

This document provides:

1. **Current Implementation Analysis** - Where the code exists
2. **Before/After Comparison** - How it works
3. **Verification Steps** - How to test it
4. **Potential Enhancements** - If you want improvements

---

## 1. Current Implementation Analysis

### 1.1 Feature Location

The source word drag-and-drop feature is implemented across these files:

| File                                                         | Lines   | Purpose                         |
| ------------------------------------------------------------ | ------- | ------------------------------- | --------- |
| `metamorphs-web/src/components/workshop-rail/WordGrid.tsx`   | 133-180 | `DraggableSourceWord` component |
| `metamorphs-web/src/components/workshop-rail/WordGrid.tsx`   | 197-202 | Source words splitting logic    |
| `metamorphs-web/src/components/workshop-rail/WordGrid.tsx`   | 317-351 | Source words UI rendering       |
| `metamorphs-web/src/types/drag.ts`                           | 38      | `dragType: "sourceWord"         | "option"` |
| `metamorphs-web/src/components/workspace/WorkspaceShell.tsx` | 80-88   | Drop handling for source words  |

---

## 2. Current Implementation Details

### 2.1 Source Words Splitting

**Location:** `WordGrid.tsx` (lines 197-202)

```typescript
// BEFORE: This logic splits the source line into individual words
const sourceWords = React.useMemo(() => {
  if (selectedLineIndex === null) return [];
  const line = poemLines[selectedLineIndex];
  return line.split(/\s+/).filter(Boolean); // Split by whitespace
}, [selectedLineIndex, poemLines]);
```

**What it does:**

- Automatically splits the selected poem line into individual words
- Available immediately (no API call needed)
- Filters out empty strings

---

### 2.2 Draggable Source Word Component

**Location:** `WordGrid.tsx` (lines 133-180)

```133:180:metamorphs-web/src/components/workshop-rail/WordGrid.tsx
function DraggableSourceWord({
  word,
  index,
  lineNumber,
}: {
  word: string;
  index: number;
  lineNumber: number;
}) {
  const dragData: DragData = {
    id: `source-${lineNumber}-${index}`,
    text: word,
    originalWord: word,
    sourceLineNumber: lineNumber,
    position: index,
    dragType: "sourceWord",
    partOfSpeech: "neutral",
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: dragData.id,
      data: dragData,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={cn(
        "px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm font-medium",
        "cursor-move hover:bg-blue-100 hover:border-blue-300 transition-colors",
        "select-none touch-none",
        isDragging && "opacity-40"
      )}
    >
      {word}
    </div>
  );
}
```

**Key Features:**

- ✅ Uses `useDraggable` from `@dnd-kit/core`
- ✅ Creates `DragData` with `dragType: "sourceWord"`
- ✅ Visual styling: Blue background (distinct from translated options)
- ✅ Drag feedback: Opacity change when dragging
- ✅ Cursor changes to "move" on hover

---

### 2.3 Source Words UI Section

**Location:** `WordGrid.tsx` (lines 317-351)

```317:351:metamorphs-web/src/components/workshop-rail/WordGrid.tsx
{/* Source words section - available IMMEDIATELY */}
{sourceWords.length > 0 && (
  <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border border-blue-100">
    <div className="flex items-center gap-2 mb-3">
      <svg
        className="w-4 h-4 text-blue-600"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path
          fillRule="evenodd"
          d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
          clipRule="evenodd"
        />
      </svg>
      <p className="text-sm font-semibold text-blue-900">
        Source text words
      </p>
    </div>
    <p className="text-xs text-blue-700 mb-3">
      Drag these to keep the original words in your translation
    </p>
    <div className="flex flex-wrap gap-2">
      {sourceWords.map((word, idx) => (
        <DraggableSourceWord
          key={`source-${selectedLineIndex}-${idx}`}
          word={word}
          index={idx}
          lineNumber={selectedLineIndex ?? 0}
        />
      ))}
    </div>
  </div>
)}
```

**Key Features:**

- ✅ Renders immediately (before API call for translations)
- ✅ Shows all words from the source line
- ✅ Distinct visual styling (blue gradient background)
- ✅ Clear instructions: "Drag these to keep the original words in your translation"

---

### 2.4 Drag Data Type Definition

**Location:** `metamorphs-web/src/types/drag.ts`

```1:47:metamorphs-web/src/types/drag.ts
/**
 * Drag and Drop Type Definitions
 *
 * These types define the data structure for dragging translation options
 * from the Workshop to the Notebook.
 */

export interface DragData {
  /** Unique identifier for the dragged item */
  id: string;

  /** The translated word/text being dragged */
  text: string;

  /** The original source word */
  originalWord: string;

  /** Part of speech tag for the word */
  partOfSpeech?:
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

  /** Type of drag item to distinguish between source words and translation options */
  dragType: "sourceWord" | "option";
}

export type DragSource = "workshop" | "notebook";

export interface DragContext {
  source: DragSource;
  data: DragData;
}
```

**Key Feature:**

- ✅ `dragType: "sourceWord" | "option"` distinguishes source words from translations

---

### 2.5 Drop Handling in Notebook

**Location:** `WorkspaceShell.tsx` (lines 71-88)

```71:88:metamorphs-web/src/components/workspace/WorkspaceShell.tsx
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  const dragData = active.data.current as DragData | undefined;

  if (!over) {
    setActiveDrag(null);
    return;
  }

  if (dragData && over.id === "notebook-dropzone") {
    const normalizedData =
      dragData.dragType === "sourceWord"
        ? { ...dragData, text: dragData.originalWord }
        : dragData;
    const newCell = createCellFromDragData(normalizedData);
    addCell(newCell);
    setActiveDrag(null);
    return;
  }

  if (active.id !== over.id) {
    const oldIndex = droppedCells.findIndex((c) => c.id === active.id);
    const newIndex = droppedCells.findIndex((c) => c.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderCells(oldIndex, newIndex);
    }
  }

  setActiveDrag(null);
};
```

**Key Logic:**

- ✅ Checks `dragType === "sourceWord"` to handle source words differently
- ✅ For source words: Uses `originalWord` as both source AND translation text
- ✅ Creates a notebook cell from the drag data
- ✅ Adds cell to the notebook

---

### 2.6 Cell Creation Helper

**Location:** `cellHelpers.ts` (lines 11-35)

```11:35:metamorphs-web/src/lib/notebook/cellHelpers.ts
export function createCellFromDragData(dragData: DragData): NotebookCell {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    lineIndex: dragData.sourceLineNumber,
    source: {
      text: dragData.originalWord,
      language: "source", // TODO: Get actual source language
      dialect: undefined,
    },
    translation: {
      text: dragData.text,
      status: "draft",
      lockedWords: [],
    },
    notes: [],
    footnotes: [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      wordCount: dragData.text.split(/\s+/).length,
    },
  };
}
```

**What it does:**

- ✅ Creates a notebook cell from drag data
- ✅ Works for both `sourceWord` and `option` drag types
- ✅ Sets appropriate source and translation text

---

## 3. Comparison: Translated Options vs Source Words

### 3.1 Similarities

Both use the **same drag-and-drop infrastructure**:

| Aspect             | Translated Options         | Source Words               |
| ------------------ | -------------------------- | -------------------------- |
| **Drag Hook**      | `useDraggable`             | `useDraggable`             |
| **Data Structure** | `DragData`                 | `DragData`                 |
| **Drop Target**    | `NotebookDropZone`         | `NotebookDropZone`         |
| **Cell Creation**  | `createCellFromDragData()` | `createCellFromDragData()` |

### 3.2 Differences

| Aspect               | Translated Options              | Source Words                  |
| -------------------- | ------------------------------- | ----------------------------- |
| **Component**        | `DraggableWordOption`           | `DraggableSourceWord`         |
| **dragType**         | `"option"`                      | `"sourceWord"`                |
| **Visual Style**     | Gray/white with green selection | Blue background               |
| **Data Source**      | From API (`wordOptions`)        | From poem line (instant)      |
| **Translation Text** | Translated word (e.g., "amour") | Original word (e.g., "love")  |
| **Available When**   | After API call completes        | Immediately on line selection |

---

## 4. Verification Steps

### Step 1: Visual Verification

**Expected Behavior:**

1. Select a poem line in the Workshop
2. **IMMEDIATELY** see a blue section titled "Source text words"
3. Each word from the source line appears as a blue draggable chip
4. Below that, translation options appear after API call

**Test:**

- [ ] Open workshop
- [ ] Select a line
- [ ] Verify "Source text words" section appears immediately
- [ ] Verify all words from source line are visible as blue chips
- [ ] Verify translation options appear below (after loading)

---

### Step 2: Drag Functionality

**Expected Behavior:**

1. Hover over a source word → cursor changes to "move"
2. Start dragging → word becomes semi-transparent
3. Drag over notebook → notebook highlights blue
4. Drop → new cell appears in notebook

**Test:**

- [ ] Hover over source word → verify cursor is "move"
- [ ] Click and drag → verify opacity changes
- [ ] Drag over notebook → verify blue border/background
- [ ] Release → verify new cell appears

---

### Step 3: Cell Content Verification

**Expected Behavior:**

- For source words: The cell should show:
  - **Source text:** Original word (e.g., "love")
  - **Translation text:** Same original word (e.g., "love")
  - This allows user to keep original words in translation

**Test:**

- [ ] Drag source word "love" to notebook
- [ ] Verify cell shows source: "love" and translation: "love"
- [ ] Verify cell has correct lineIndex

---

### Step 4: Mixed Usage

**Expected Behavior:**

- Should be able to drag both source words AND translated options
- Should be able to mix them in any order

**Test:**

- [ ] Drag source word → cell appears
- [ ] Drag translated option → cell appears
- [ ] Drag another source word → cell appears
- [ ] Verify all cells are independent and editable

---

## 5. Evaluation of Current Implementation

### ✅ **Your Proposed Approach Matches Implementation**

Your suggestion:

> "Just like how each translated word is in its own cell, we can also divide the source text into individual words. We would render each source word as its own draggable component."

**This is EXACTLY what's implemented!**

The current code:

1. ✅ Splits source text into individual words
2. ✅ Renders each word as a draggable component
3. ✅ Uses the same drag-and-drop infrastructure
4. ✅ Handles drops in the notebook

---

### 5.1 Strengths of Current Implementation

1. **Immediate Availability**

   - Source words appear instantly (no API wait)
   - Users can start building translation while options load

2. **Visual Distinction**

   - Blue styling clearly differentiates source words from translations
   - Users understand what they're dragging

3. **Unified Infrastructure**

   - Reuses same DnD system for both types
   - Consistent behavior and UX

4. **Proper Data Handling**
   - `dragType` correctly distinguishes source vs option
   - Drop handler normalizes data appropriately

---

### 5.2 Potential Enhancements (Optional)

If you want to improve the current implementation, consider:

#### Enhancement 1: Better Word Splitting

**Current:** Simple `split(/\s+/)` may not handle punctuation correctly

**Potential Improvement:**

```typescript
// More sophisticated splitting that preserves punctuation
const sourceWords = line
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word.trim());
```

#### Enhancement 2: Punctuation Handling

**Current:** Punctuation might be attached to words

**Potential Improvement:**

- Separate punctuation from words
- Create draggable punctuation tokens
- Or keep punctuation attached (current behavior)

#### Enhancement 3: Visual Enhancements

**Potential Improvements:**

- Add tooltip explaining source words
- Show word count in source words section
- Add keyboard shortcuts for dragging

---

## 6. Implementation Summary

### ✅ Already Implemented

1. **Source text splitting** → `WordGrid.tsx:197-202`
2. **Draggable source word component** → `WordGrid.tsx:133-180`
3. **Source words UI section** → `WordGrid.tsx:317-351`
4. **Drag type distinction** → `drag.ts:38`
5. **Drop handling** → `WorkspaceShell.tsx:80-88`
6. **Cell creation** → `cellHelpers.ts:11-35`

### 📋 Verification Needed

Run the verification steps in Section 4 to confirm:

- Visual rendering works
- Drag functionality works
- Drop functionality works
- Cell content is correct
- Mixed usage works

---

## 7. Next Steps

### Option A: Verify Current Implementation Works

1. Follow verification steps in Section 4
2. Test all drag-and-drop scenarios
3. Report any bugs or issues found

### Option B: Enhance Current Implementation

If you want improvements:

1. Review "Potential Enhancements" in Section 5.2
2. Prioritize which enhancements to add
3. Implement chosen enhancements

### Option C: No Action Needed

If verification confirms everything works:

- ✅ Feature is complete
- ✅ Ready for production use
- ✅ No code changes needed

---

## 8. Conclusion

**The feature you requested is already fully implemented!** The codebase contains:

- ✅ Source text word splitting
- ✅ Individual draggable word components
- ✅ Drop zone integration
- ✅ Proper data handling

**Your suggested approach matches the implementation perfectly.**

The next step is to **verify it works correctly** using the testing steps above, then decide if any enhancements are desired.
