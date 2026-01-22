# Word Options Architecture & Single-Word Suggestions Feature Plan

## Table of Contents
1. [Current Word Options System](#current-word-options-system)
2. [Word Cell Design](#word-cell-design)
3. [Single-Word Suggestions Feature Plan](#single-word-suggestions-feature-plan)
4. [Implementation Considerations](#implementation-considerations)

---

## Current Word Options System

### Overview

The word options system in Translalia allows users to see and interact with translation alternatives at multiple levels:
1. **Line-level translations** (3 variants per line) - Primary workflow
2. **Word-level tokens** within each variant - Individual draggable words
3. **Source words** - Original words from the source text
4. **Additional suggestions** - Context-aware word alternatives for the entire line

### Architecture Layers

#### 1. Data Structure Layer

**Location:** `src/types/lineTranslation.ts`

```typescript
// Core structure for aligned words
interface AlignedWord {
  original: string;        // Source word/phrase
  translation: string;     // Translated word/phrase
  partOfSpeech: string;    // POS tag (noun, verb, etc.)
  position: number;        // Position in original line (0-indexed)
}

// Line translation variant (one of 3)
interface LineTranslationVariant {
  variant: 1 | 2 | 3;
  fullText: string;        // Complete translated line
  words: AlignedWord[];    // Word-level alignment
  metadata: {
    literalness: number;   // 0-1 scale
    characterCount: number;
    preservesRhyme?: boolean;
    preservesMeter?: boolean;
  };
}

// Complete response for a line
interface LineTranslationResponse {
  lineOriginal: string;
  translations: [LineTranslationVariant, LineTranslationVariant, LineTranslationVariant];
  modelUsed: string;
}
```

**Key Characteristics:**
- Each line has exactly 3 translation variants
- Each variant contains word-level alignment (original → translation)
- Words can be multi-word phrases (e.g., "sat on" → "se sentó en")
- Position tracking enables word-to-word mapping

#### 2. Drag & Drop System

**Location:** `src/types/drag.ts`

```typescript
interface DragData {
  id: string;                    // Unique identifier
  text: string;                  // Translated word being dragged
  originalWord: string;          // Original source word
  partOfSpeech?: string;         // POS tag
  sourceLineNumber: number;      // Which line this word comes from
  position: number;               // Position in line
  dragType: "sourceWord" | "option" | "variantWord";
  variantId?: number;            // Which variant (1, 2, or 3)
  stanzaIndex?: number;
  metadata?: Record<string, unknown>;
}
```

**Drag Types:**
- `sourceWord`: Original word from source text (blue background)
- `variantWord`: Translated word from a variant (colored by POS)
- `option`: Legacy word-by-word option (deprecated)

**Drag Flow:**
1. User drags a word from Workshop (source or variant)
2. Drops onto Notebook dropzone
3. Word is appended to draft translation via `appendToDraft()`
4. Draft state is managed in `workshopSlice`

#### 3. UI Component Layer

**Location:** `src/components/workshop-rail/WordGrid.tsx`

**Component Hierarchy:**
```
WordGrid (Main container)
├── SourceWordsPalette (Source words at top)
│   └── DraggableSourceWord (Individual source words)
├── TranslationVariantCard × 3 (One per variant)
│   └── DraggableVariantToken (Individual translated words)
└── AdditionalSuggestions (Line-level suggestions)
```

**Key Components:**

1. **DraggableSourceWord** (Lines 81-175)
   - Blue background (`bg-blue-50`)
   - Shows original source word
   - Click or drag to add to notebook
   - `dragType: "sourceWord"`

2. **DraggableVariantToken** (Lines 859-970)
   - Colored by part of speech (POS_COLORS)
   - Shows translated word from variant
   - Displays original word in tooltip
   - `dragType: "variantWord"`
   - Includes `variantId` in drag data

3. **TranslationVariantCard** (Lines 727-849)
   - Container for one variant (1, 2, or 3)
   - Shows all tokens in a flex-wrap grid
   - Click card to add entire variant to draft
   - Visual selection state (green border when selected)

4. **AdditionalSuggestions** (Lines 613-619)
   - Shows 7-9 context-aware word suggestions
   - Generated for the entire line
   - Click word to add to draft
   - Can be refined with user guidance

---

## Word Cell Design

### Visual Design

#### Source Words (`DraggableSourceWord`)
- **Background:** `bg-blue-50` (light blue)
- **Border:** `border-blue-200`
- **Hover:** `hover:bg-blue-100 hover:border-blue-300`
- **Size:** `px-3 py-1.5` (compact)
- **Shape:** Rounded corners
- **Interaction:** Click or drag to add to notebook

#### Variant Tokens (`DraggableVariantToken`)
- **Background:** Colored by part of speech (POS_COLORS)
- **Shape:** `rounded-lg` with border
- **Size:** `px-3 py-2` (slightly larger)
- **Shadow:** `shadow-sm` with hover elevation
- **Hover:** `hover:-translate-y-0.5 hover:shadow` (lift effect)
- **Dragging:** `opacity-60 scale-95` (visual feedback)

**POS Color Mapping:**
```typescript
const POS_COLORS = {
  noun: "bg-blue-50 text-blue-700 border-blue-200",
  verb: "bg-green-50 text-green-700 border-green-200",
  adjective: "bg-purple-50 text-purple-700 border-purple-200",
  adverb: "bg-orange-50 text-orange-700 border-orange-200",
  pronoun: "bg-pink-50 text-pink-700 border-pink-200",
  preposition: "bg-yellow-50 text-yellow-700 border-yellow-200",
  conjunction: "bg-indigo-50 text-indigo-700 border-indigo-200",
  article: "bg-gray-50 text-gray-700 border-gray-200",
  interjection: "bg-red-50 text-red-700 border-red-200",
  neutral: "bg-slate-50 text-slate-700 border-slate-200",
}
```

### Interaction Patterns

1. **Click to Add:**
   - Single click on word → adds to draft immediately
   - Visual feedback: `scale-[1.03] ring-2 ring-green-200` (250ms)
   - Prevents accidental double-adds with `justDraggedRef`

2. **Drag to Add:**
   - Drag word to notebook dropzone
   - Visual feedback during drag: opacity change
   - Drop appends word to draft for target line

3. **Keyboard Navigation:**
   - `Enter` or `Space` to add word
   - Full keyboard accessibility support

4. **Card-Level Actions:**
   - Click variant card → adds entire variant to draft
   - Clicking on draggable token doesn't trigger card action
   - Selection state for visual feedback

### State Management

**Location:** `src/store/workshopSlice.ts`

```typescript
interface WorkshopState {
  currentLineIndex: number | null;        // Currently selected line
  lineTranslations: Record<number, LineTranslationResponse>;
  selectedVariant: Record<number, 1 | 2 | 3 | null>;  // Selected variant per line
  draftLines: Record<number, string>;     // Draft translations per line
  completedLines: Record<number, string>; // Finalized translations
  poemLines: string[];                    // Source poem lines
}
```

**Key Actions:**
- `appendToDraft(lineIndex, text)`: Adds word to draft
- `setCurrentLineIndex(index)`: Changes active line
- `selectVariant(lineIndex, variant)`: Selects variant for line

---

## Single-Word Suggestions Feature Plan

### Feature Overview

**Goal:** Allow users to select any single word (from source text or any variant) and request context-aware suggestions specifically for that word.

**Use Cases:**
1. User sees a word in variant 2 but wants more alternatives
2. User wants suggestions for a specific source word
3. User wants to refine a word choice with more context

### Design Requirements

#### 1. Word Selection Mechanism

**Option A: Right-Click Context Menu** (Recommended)
- Right-click any word → Context menu appears
- Menu item: "Get suggestions for this word"
- Pros: Non-intrusive, familiar pattern
- Cons: Less discoverable on mobile

**Option B: Hover + Icon Button**
- Hover over word → Small icon button appears
- Click icon → Request suggestions
- Pros: More discoverable
- Cons: Can be cluttered with many words

**Option C: Selection Mode**
- Toggle "suggestion mode"
- Click word to select it
- Button appears to request suggestions
- Pros: Clear intent, less accidental triggers
- Cons: Extra step, mode switching

**Recommendation:** **Option A (Right-Click Context Menu)** with fallback to long-press on mobile.

#### 2. UI Components

**New Component: `WordSuggestionsMenu`**
```typescript
interface WordSuggestionsMenuProps {
  word: string;              // Selected word
  originalWord?: string;     // Original if from variant
  lineIndex: number;         // Which line
  position: number;          // Position in line
  variantId?: number;        // Which variant (if applicable)
  source: "source" | "variant";  // Where word came from
  onClose: () => void;
  onSuggestionClick: (suggestion: string) => void;
}
```

**Features:**
- Shows selected word prominently
- Displays context (line, variant if applicable)
- Button: "Get 7-9 suggestions for this word"
- Loading state during generation
- Results displayed in modal or dropdown

**New Component: `SingleWordSuggestions`**
- Similar to `AdditionalSuggestions` but for single word
- Shows word being suggested for
- Displays 7-9 alternatives
- Click to add to draft
- Can refine with guidance

#### 3. API Design

**New Endpoint:** `POST /api/workshop/single-word-suggestions`

**Request Schema:**
```typescript
{
  threadId: string;
  lineIndex: number;
  word: string;              // The word to get suggestions for
  originalWord?: string;     // Original word if from variant
  position: number;          // Position in line
  variantId?: number;        // Which variant (1, 2, 3) if applicable
  source: "source" | "variant";
  currentLine: string;       // Full current line
  previousLine?: string | null;
  nextLine?: string | null;
  fullPoem: string;
  poemTheme?: string;
  userGuidance?: string | null;  // For refinement
}
```

**Response Schema:**
```typescript
{
  ok: true;
  suggestions: Array<{
    word: string;
    reasoning: string;
    register: string;
    literalness: number;
  }>;
  targetWord: string;        // The word suggestions are for
  lineIndex: number;
}
```

#### 4. Prompt Engineering

**Location:** `src/lib/ai/workshopPrompts.ts`

**New Function:** `buildSingleWordSuggestionsPrompt()`

**Key Considerations:**
- Focus on the specific word, not the entire line
- Consider word's position in line (beginning, middle, end)
- Consider part of speech
- Consider surrounding words for context
- Maintain translator personality
- Consider rhyme/meter if word is at line end/beginning

**Prompt Structure:**
```
1. Translator Personality (same as line-level)
2. Full Poem Context
3. Current Line with highlighted word
4. Previous/Next Lines
5. Word-Specific Context:
   - Position in line
   - Part of speech
   - Surrounding words
   - Role in line (subject, verb, object, etc.)
6. Task: Generate 7-9 alternatives for THIS SPECIFIC WORD
7. Requirements:
   - Must fit grammatically in the line
   - Must maintain meaning
   - Consider rhyme if at line end
   - Honor translator personality
```

#### 5. State Management

**New State in `WordGrid`:**
```typescript
const [selectedWord, setSelectedWord] = useState<{
  word: string;
  originalWord?: string;
  lineIndex: number;
  position: number;
  variantId?: number;
  source: "source" | "variant";
} | null>(null);

const [singleWordSuggestions, setSingleWordSuggestions] = useState<WordSuggestion[]>([]);
const [isLoadingSingleWordSuggestions, setIsLoadingSingleWordSuggestions] = useState(false);
```

**State Flow:**
1. User right-clicks word → `setSelectedWord({...})`
2. User clicks "Get suggestions" → API call
3. Loading state → `setIsLoadingSingleWordSuggestions(true)`
4. Results → `setSingleWordSuggestions([...])`
5. User clicks suggestion → Add to draft, clear state

#### 6. Integration Points

**Modify `DraggableSourceWord`:**
- Add `onContextMenu` handler
- Prevent default context menu
- Show custom menu with "Get suggestions" option

**Modify `DraggableVariantToken`:**
- Add `onContextMenu` handler
- Include variant ID in selection data
- Show custom menu

**New Context Menu Component:**
- Positioned at cursor
- Shows word info
- "Get suggestions" button
- "Cancel" option

#### 7. Visual Design

**Context Menu:**
- Dark background (`bg-slate-900`)
- White text
- Rounded corners
- Shadow
- Positioned near cursor
- Auto-closes on outside click

**Suggestions Display:**
- Modal or dropdown (prefer modal for focus)
- Shows selected word prominently
- Grid of suggestion chips (same as AdditionalSuggestions)
- Loading spinner
- Refine button (optional)

**Word Highlighting:**
- When word is selected for suggestions, highlight it
- Subtle border or background change
- Clear visual connection to suggestions

---

## Implementation Considerations

### 1. Context Gathering

**Challenge:** Need to gather context for a single word, not entire line.

**Solution:**
- Use existing `lineContext` prop in `WordGrid`
- Extract word's position and surrounding words
- Consider grammatical role (subject, verb, object)
- Consider line position (beginning, middle, end)

**Data Needed:**
```typescript
{
  word: "palabra",
  originalWord: "word",  // If from variant
  position: 2,           // 0-indexed in line
  lineIndex: 5,
  currentLine: "La palabra es importante",
  previousWord: "La",    // Word before
  nextWord: "es",        // Word after
  isLineStart: false,
  isLineEnd: false,
  partOfSpeech: "noun",
  variantId: 2,          // If from variant
}
```

### 2. API Efficiency

**Considerations:**
- Single-word suggestions are more targeted → potentially faster
- Can use same model (`gpt-4o-mini`) or lighter model
- Cache suggestions per word+context hash?
- Rate limiting for rapid requests

**Optimization:**
- Batch requests if user selects multiple words quickly?
- Debounce rapid selections
- Cache common words?

### 3. User Experience

**Discoverability:**
- Tooltip on hover: "Right-click for suggestions"
- Help text in UI
- Tutorial/onboarding

**Feedback:**
- Clear loading state
- Error handling
- Success feedback when suggestion added

**Accessibility:**
- Keyboard shortcut for context menu
- Screen reader announcements
- Focus management

### 4. Edge Cases

**Multi-word Phrases:**
- What if word is part of multi-word phrase?
- Solution: Treat as single unit, suggest alternatives for entire phrase

**Empty/Invalid Words:**
- Handle punctuation-only "words"
- Handle empty strings
- Validation before API call

**Line Changes:**
- What if user changes line while suggestions loading?
- Cancel in-flight requests
- Clear suggestions on line change

**Word Not Found:**
- What if word doesn't exist in line?
- Validation before showing menu
- Graceful error handling

### 5. Performance

**Rendering:**
- Context menu should not cause re-renders
- Use portal for menu (outside main DOM tree)
- Optimize suggestion list rendering

**API Calls:**
- Debounce rapid selections
- Cancel previous requests if new one starts
- Show loading state immediately

**State Updates:**
- Minimize state updates
- Batch related updates
- Use React.memo for suggestion components

### 6. Testing Strategy

**Unit Tests:**
- Word selection logic
- Context gathering
- API request building
- State management

**Integration Tests:**
- Right-click → menu appears
- Click "Get suggestions" → API called
- Suggestions displayed
- Click suggestion → added to draft

**E2E Tests:**
- Full flow: select word → get suggestions → add to draft
- Error handling
- Loading states
- Mobile (long-press)

### 7. Backward Compatibility

**Considerations:**
- Existing "Get More Suggestions" feature should remain unchanged
- New feature is additive, not replacement
- Both features can coexist
- No breaking changes to existing APIs

### 8. Mobile Considerations

**Touch Interactions:**
- Long-press instead of right-click
- Larger touch targets
- Simplified menu on mobile
- Consider bottom sheet for suggestions

**Performance:**
- Mobile may be slower
- Consider lighter model for mobile?
- Optimize for smaller screens

### 9. Analytics & Monitoring

**Track:**
- How often feature is used
- Which words get suggestions most
- Success rate (suggestions added to draft)
- Time to generate suggestions
- Error rates

**Metrics:**
- Feature adoption rate
- Average suggestions per session
- Most requested words
- API response times

### 10. Future Enhancements

**Potential Additions:**
- Batch suggestions for multiple words
- Save favorite suggestions
- Suggest based on selected word's style
- Compare suggestions across variants
- Export suggestions

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create `WordSuggestionsMenu` component
- [ ] Add right-click handlers to `DraggableSourceWord`
- [ ] Add right-click handlers to `DraggableVariantToken`
- [ ] Implement context menu positioning
- [ ] Add state management for selected word

### Phase 2: API Integration
- [ ] Create `/api/workshop/single-word-suggestions` endpoint
- [ ] Implement `buildSingleWordSuggestionsPrompt()`
- [ ] Add request/response validation
- [ ] Implement error handling
- [ ] Add loading states

### Phase 3: UI Components
- [ ] Create `SingleWordSuggestions` component
- [ ] Integrate with `WordGrid`
- [ ] Add loading indicators
- [ ] Implement suggestion display
- [ ] Add refine functionality

### Phase 4: Polish
- [ ] Add tooltips and help text
- [ ] Implement keyboard shortcuts
- [ ] Add mobile support (long-press)
- [ ] Optimize performance
- [ ] Add analytics

### Phase 5: Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Mobile testing
- [ ] Accessibility testing

---

## Summary

The single-word suggestions feature builds on the existing word options architecture by:

1. **Leveraging existing infrastructure:**
   - Drag & drop system
   - State management
   - API patterns
   - UI components

2. **Adding targeted functionality:**
   - Word-level selection
   - Context-aware suggestions for specific words
   - Right-click context menu

3. **Maintaining consistency:**
   - Same visual design language
   - Same interaction patterns
   - Same API structure

4. **Enhancing user experience:**
   - More granular control
   - Faster iteration on word choices
   - Better context understanding

The feature is designed to be additive and non-breaking, seamlessly integrating with the existing word options system while providing users with more focused translation assistance.
