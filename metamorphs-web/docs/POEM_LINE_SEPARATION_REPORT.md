# Poem Line Separation Report

**Date:** 2025-10-16  
**Application:** Translalia Poetry Translation Workshop  
**Version:** Current (as of analysis)

---

## Executive Summary

This report provides a comprehensive analysis of how the Translalia application recognizes, processes, and manages line separation in poetry text. The system uses a **newline-based splitting algorithm** with **whitespace trimming** and **empty line filtering** to convert raw poem text into an array of individual lines that can be translated independently.

---

## 1. Overview of Line Separation Flow

### 1.1 High-Level Architecture

```
User Input (GuideRail)
        ↓
   Poem Text Storage (GuideStore)
        ↓
   Line Splitting Logic (WorkshopRail)
        ↓
   Workshop Storage (WorkshopStore)
        ↓
   Line Display & Translation (LineSelector, WordGrid)
```

### 1.2 Data Flow Summary

1. **User inputs poem** → Stored as single string in `GuideStore.poem.text`
2. **Workshop Rail watches for poem changes** → Triggers line splitting
3. **Lines are split and stored** → Array stored in `WorkshopStore.poemLines`
4. **Components consume line array** → Display and translation operations

---

## 2. Detailed Technical Implementation

### 2.1 Core Line Splitting Algorithm

**Location:** `metamorphs-web/src/components/workshop-rail/WorkshopRail.tsx` (lines 33-39)

```typescript
const lines = poem.text
  .split("\n") // Split on newline characters
  .map((l) => l.trim()) // Remove leading/trailing whitespace
  .filter(Boolean); // Remove empty strings
```

#### Algorithm Breakdown:

1. **`.split("\n")`**

   - Splits the raw poem text at every newline character (`\n`)
   - Creates an array of strings, one per line
   - Preserves all content including whitespace-only lines

2. **`.map((l) => l.trim())`**

   - Iterates through each line
   - Removes leading and trailing whitespace from each line
   - Converts whitespace-only lines to empty strings

3. **`.filter(Boolean)`**
   - Filters out falsy values (empty strings, `null`, `undefined`)
   - Removes blank lines from the final array
   - Ensures only lines with actual content are kept

### 2.2 Input Source

**Location:** `metamorphs-web/src/store/guideSlice.ts` (lines 31-34)

```typescript
poem: {
  text: string | null;
  isSubmitted: boolean;
}
```

The poem text is stored as a **single multi-line string** with newline characters (`\n`) embedded within it.

**Input Method:** `metamorphs-web/src/components/guide/GuideRail.tsx` (lines 279-290)

```typescript
<textarea
  id="poem-input"
  ref={poemTextareaRef}
  rows={7}
  maxLength={POEM_CHAR_LIMIT}
  value={poemText}
  onChange={handlePoemChange}
  onKeyDown={handlePoemKeyDown}
  placeholder="Paste the original text here..."
  className="w-full resize-y rounded-xl..."
/>
```

**Character Limit:** 5,000 characters (defined as `POEM_CHAR_LIMIT`)

### 2.3 Storage Architecture

#### Frontend State Management

**Workshop Store:** `metamorphs-web/src/store/workshopSlice.ts`

```typescript
export interface WorkshopState {
  poemLines: string[]; // Array of individual poem lines
  completedLines: Record<number, string>; // Line index → translation
  selectedLineIndex: number | null; // Currently selected line
  // ... other fields
}
```

**Persistence:** Thread-scoped localStorage via Zustand persist middleware

```typescript
partialize: (state) => ({
  meta: state.meta,
  poemLines: state.poemLines, // ← Persisted
  completedLines: state.completedLines,
  modelUsed: state.modelUsed,
  selectedLineIndex: state.selectedLineIndex,
});
```

#### Backend Database Schema

**Table:** `versions`  
**Column:** `lines` (PostgreSQL type: `text[]`)

```typescript
export type Version = {
  id: string;
  title: string;
  lines: string[]; // Array of line strings
  tags: string[];
  meta?: object;
  // ... other fields
};
```

**Storage Location:** Supabase PostgreSQL database  
**Data Type:** Native PostgreSQL array of text strings

---

## 3. Line Processing Pipeline

### 3.1 Reactive Update Mechanism

**Location:** `metamorphs-web/src/components/workshop-rail/WorkshopRail.tsx` (lines 26-45)

```typescript
React.useEffect(() => {
  if (poem.text) {
    const lines = poem.text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    setPoemLines(lines);
  } else if (!poem.text && poemLines.length > 0) {
    // Clear workshop if poem is cleared
    reset();
  }
}, [poem.text, setPoemLines, poemLines.length, reset]);
```

**Triggers:**

- Changes to `poem.text` in GuideStore
- User submits poem in Guide Rail
- User clears poem text

**Dependencies:**

- `poem.text` - Source poem string
- `setPoemLines` - Workshop store action
- `poemLines.length` - Current line count
- `reset` - Workshop reset function

### 3.2 Line Indexing

Lines are **zero-indexed** throughout the application:

```typescript
{
  poemLines.map((line, idx) => {
    // idx: 0, 1, 2, 3...
    <div>Line {idx + 1}</div>; // Display: 1, 2, 3, 4...
  });
}
```

**Display Convention:** Lines shown to users start at 1 (e.g., "Line 1", "Line 2")  
**Internal Storage:** Array indices start at 0 (e.g., `poemLines[0]`, `poemLines[1]`)

---

## 4. Edge Cases & Handling

### 4.1 Empty Lines

**Behavior:** Empty lines (blank lines with only whitespace) are **removed**

```typescript
Input: "Line one\n\n\nLine two\n   \nLine three";

Output: ["Line one", "Line two", "Line three"];
```

**Rationale:** Poetry translation focuses on content-bearing lines. Stanza breaks can be preserved through manual formatting in translated output.

### 4.2 Leading/Trailing Whitespace

**Behavior:** Whitespace at the start and end of each line is **trimmed**

```typescript
Input: "  Line with spaces  \n\tTabbed line\t";

Output: ["Line with spaces", "Tabbed line"];
```

**Note:** Internal whitespace within lines is preserved.

### 4.3 Single-Line Poems

**Behavior:** Works correctly with single-line input

```typescript
Input: "A single line poem";

Output: ["A single line poem"];
```

### 4.4 Very Long Lines

**Constraint:** Individual lines are limited by the 5,000 character total poem limit  
**No per-line limit** is enforced  
**UI Handling:** Lines are truncated in selector view with ellipsis

```typescript
<div className="truncate text-sm">{line}</div>
```

### 4.5 Special Characters

**Newline Variations:**

- `\n` (LF - Unix/Mac) ✅ Supported
- `\r\n` (CRLF - Windows) ⚠️ May create empty lines from `\r`
- `\r` (CR - Old Mac) ❌ Not split (treated as single line)

**Current Implementation:** Only splits on `\n`

**Recommendation:** Pre-process input to normalize line endings

```typescript
// Proposed enhancement
const normalizedText = poem.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const lines = normalizedText.split("\n")...
```

---

## 5. Line Display & Interaction

### 5.1 Line Selector Component

**Location:** `metamorphs-web/src/components/workshop-rail/LineSelector.tsx`

```typescript
export function LineSelector({ poemLines }: { poemLines: string[] }) {
  return (
    <div className="p-3 space-y-2">
      {poemLines.map((line, idx) => (
        <Card key={idx}>
          <div className="text-xs">Line {idx + 1}</div>
          <div className="truncate text-sm">{line}</div>
          <Badge>{completed ? "Complete" : "Untranslated"}</Badge>
        </Card>
      ))}
    </div>
  );
}
```

**Features:**

- Displays all lines with 1-based numbering
- Shows completion status per line
- Click to select line for translation
- Truncates long lines with ellipsis

### 5.2 Translation State Tracking

**Completed Lines Storage:**

```typescript
completedLines: Record<number, string>;
// Example: { 0: "Primera línea", 2: "Tercera línea" }
```

**Key:** Line index (0-based)  
**Value:** Translated text  
**Missing entries:** Untranslated lines

---

## 6. Text Normalization Utilities

### 6.1 Similarity Checking

**Location:** `metamorphs-web/src/lib/text/similarity.ts`

```typescript
function normalizedLines(lines: string[]): string[] {
  return (lines || [])
    .map((s) =>
      s
        .normalize("NFKC") // Unicode normalization
        .toLowerCase() // Case normalization
        .replace(/\s+/g, " ") // Whitespace normalization
        .trim()
    ) // Trim edges
    .filter(Boolean); // Remove empty
}
```

**Used For:**

- Detecting echo/copied translations
- Line-level similarity comparison
- Quality checks

**Normalization Steps:**

1. **NFKC Unicode normalization** - Canonical decomposition + compatibility composition
2. **Lowercase conversion** - Case-insensitive comparison
3. **Whitespace collapse** - Multiple spaces → single space
4. **Trim** - Remove leading/trailing whitespace
5. **Filter empty** - Remove blank entries

---

## 7. Performance Considerations

### 7.1 Re-rendering Optimization

**Reactive Dependencies:**

```typescript
React.useEffect(() => {
  // Only re-runs when poem.text actually changes
}, [poem.text, setPoemLines, poemLines.length, reset]);
```

**Memoization:** None currently implemented for line array

**Potential Optimization:**

```typescript
const poemLines = useMemo(
  () =>
    poem.text
      ?.split("\n")
      .map((l) => l.trim())
      .filter(Boolean) || [],
  [poem.text]
);
```

### 7.2 Large Poem Handling

**Current Limits:**

- Max poem length: 5,000 characters
- No limit on number of lines
- Estimated max lines: ~250-500 (depending on average line length)

**Performance Impact:**

- Array operations: O(n) where n = number of lines
- React rendering: O(n) for line selector
- **No pagination** currently implemented

---

## 8. Integration Points

### 8.1 Components Consuming Line Data

| Component           | Purpose                    | Line Access Pattern                         |
| ------------------- | -------------------------- | ------------------------------------------- |
| `WorkshopRail`      | Orchestrator               | Watches `poem.text`, calls `setPoemLines()` |
| `LineSelector`      | Line list UI               | Receives `poemLines` as prop, displays all  |
| `WordGrid`          | Word-by-word translation   | Accesses `poemLines[selectedLineIndex]`     |
| `CompilationFooter` | Final translation assembly | Reads `poemLines` and `completedLines`      |
| `WorkshopHeader`    | Progress indicator         | Counts `poemLines.length`                   |

### 8.2 State Synchronization

**Guide Store → Workshop Store:**

```typescript
// One-way data flow
GuideStore.poem.text → WorkshopStore.poemLines
```

**No reverse sync:** Workshop doesn't modify source poem text

**Thread Isolation:** Each thread has independent poem lines storage

```typescript
merge: (persisted, current) => {
  if (p.meta?.threadId !== tid) {
    return { ...current, hydrated: true, meta: { threadId: tid } };
  }
  // Use persisted state only if thread matches
};
```

---

## 9. Known Limitations & Issues

### 9.1 Current Limitations

1. **Windows Line Endings:** `\r\n` may cause issues
2. **No Stanza Preservation:** Empty lines between stanzas are removed
3. **No Visual Line Breaks:** Can't preserve intentional spacing within poems
4. **Max Poem Length:** 5,000 character hard limit
5. **No Line Merging:** Can't combine multiple short lines into one

### 9.2 Potential Enhancements

#### A. Preserve Stanza Structure

```typescript
// Enhanced algorithm
const lines = poem.text
  .split("\n")
  .map((l) => l.trim())
  // Don't filter empty - represent as special marker
  .map((l) => l || "___STANZA_BREAK___");
```

#### B. Line Ending Normalization

```typescript
const normalizedText = poem.text
  .replace(/\r\n/g, "\n") // Windows → Unix
  .replace(/\r/g, "\n"); // Old Mac → Unix
```

#### C. Preserve Indentation

```typescript
const lines = poem.text
  .split("\n")
  .map((l) => ({
    text: l.trim(),
    indent: l.match(/^\s*/)?.[0].length || 0,
  }))
  .filter((l) => l.text);
```

#### D. Line Number Preservation

```typescript
const lines = poem.text
  .split("\n")
  .map((text, originalIndex) => ({
    text: text.trim(),
    originalLineNumber: originalIndex + 1,
  }))
  .filter((l) => l.text);
```

---

## 10. Testing Scenarios

### 10.1 Recommended Test Cases

```typescript
// Test 1: Simple multi-line poem
Input: "Line 1\nLine 2\nLine 3"
Expected: ["Line 1", "Line 2", "Line 3"]

// Test 2: Empty lines
Input: "Line 1\n\nLine 2\n\n\nLine 3"
Expected: ["Line 1", "Line 2", "Line 3"]

// Test 3: Whitespace variations
Input: "  Line 1  \n\tLine 2\t\n   \nLine 3"
Expected: ["Line 1", "Line 2", "Line 3"]

// Test 4: Single line
Input: "Only one line"
Expected: ["Only one line"]

// Test 5: Windows line endings
Input: "Line 1\r\nLine 2\r\nLine 3"
Expected: ["Line 1", "Line 2", "Line 3"] (currently may fail)

// Test 6: Unicode characters
Input: "Línea 1\nΓραμμή 2\n行 3"
Expected: ["Línea 1", "Γραμμή 2", "行 3"]
```

### 10.2 Edge Case Testing

```typescript
// Empty input
Input: ""
Expected: []

// Only whitespace
Input: "   \n\n\t\t\n   "
Expected: []

// Very long line
Input: "A".repeat(5000)
Expected: ["AAA...AAA"] (single element)

// Mixed content
Input: "Normal line\n   \nSpaced   words\n\t\tTabbed"
Expected: ["Normal line", "Spaced   words", "Tabbed"]
```

---

## 11. Recommendations

### 11.1 High Priority

1. **Normalize Line Endings**

   - Add pre-processing to handle `\r\n` and `\r`
   - Ensures cross-platform compatibility

2. **Document Line Limit**

   - Add UI hint about 5,000 character limit
   - Show character count during input

3. **Add Unit Tests**
   - Test line splitting algorithm
   - Verify edge cases

### 11.2 Medium Priority

1. **Preserve Stanza Breaks**

   - Add optional stanza markers
   - Allow users to toggle stanza preservation

2. **Line Preview**

   - Show line count preview in Guide Rail
   - Display first/last lines as confirmation

3. **Indentation Support**
   - Preserve leading whitespace for formatted poems
   - Add UI toggle for indentation preservation

### 11.3 Low Priority

1. **Pagination**

   - Add for poems with 50+ lines
   - Improve performance for very long poems

2. **Line Merging**

   - Allow combining short lines
   - Useful for certain poetic forms

3. **Export Format Options**
   - Preserve original formatting
   - Allow custom line separators

---

## 12. Conclusion

The Translalia application uses a **simple and effective newline-based splitting algorithm** for poem line separation. The implementation is:

✅ **Predictable** - Consistent behavior across the application  
✅ **Efficient** - O(n) complexity, minimal overhead  
✅ **Maintainable** - Clear, readable code  
✅ **Adequate** - Handles most common poetry formats

However, there are opportunities for enhancement:

⚠️ **Line ending normalization** needed for cross-platform support  
⚠️ **Stanza preservation** would improve user experience  
⚠️ **Testing** should be added to prevent regressions

The current implementation serves the core use case well, and the recommended enhancements would make it more robust and feature-complete.

---

## Appendix A: Code References

### Primary Files

1. **Line Splitting Logic**

   - `metamorphs-web/src/components/workshop-rail/WorkshopRail.tsx` (lines 33-39)

2. **State Management**

   - `metamorphs-web/src/store/workshopSlice.ts` (lines 34, 111-115)
   - `metamorphs-web/src/store/guideSlice.ts` (lines 31-34)

3. **Display Components**

   - `metamorphs-web/src/components/workshop-rail/LineSelector.tsx`
   - `metamorphs-web/src/components/workshop-rail/WordGrid.tsx`

4. **Utilities**
   - `metamorphs-web/src/lib/text/similarity.ts` (normalizedLines function)

### Database Schema

5. **Backend Storage**
   - Database table: `versions` (column: `lines text[]`)
   - Type definition: `metamorphs-web/src/types/workspace.ts`

---

**Report Prepared By:** AI Technical Analyst  
**Review Status:** Draft - Ready for Engineering Review  
**Next Steps:** Implement high-priority recommendations and add test coverage
