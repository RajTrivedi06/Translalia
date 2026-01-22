# Get More Suggestions Feature - Complete Documentation

## Overview

The "Get More Suggestions" feature is a context-aware word suggestion system for the poetry translation workshop. It generates 7-9 additional word alternatives for a specific line in a poem translation, considering:
- Full poem context
- Neighboring lines (previous and next) for flow and rhyme
- Translator personality (domain, register, style preferences)
- User-provided guidance (for refinement)

## Feature Location

The button appears in the **Workshop Rail** → **WordGrid** component, below the line translation variants. It's part of the `AdditionalSuggestions` component.

**DOM Path:**
```
div.locale-wrapper > main > div > div.flex > div.flex-1 > div.relative.grid > 
div.flex (workshop rail) > div.flex-1 > div.h-full > div.flex-1 > 
div.space-y-6 > div.border-t > button (Get More Suggestions)
```

## Architecture

### Component Hierarchy

```
ThreadPageClient
  └── WorkshopRail
      └── WordGrid
          └── AdditionalSuggestions (Main UI Component)
              └── RegenerateGuidanceDialog (Refinement Dialog)
```

## Core Files

### 1. UI Component: `AdditionalSuggestions.tsx`

**Location:** `translalia-web/src/components/workshop/AdditionalSuggestions.tsx`

**Purpose:** Main UI component that displays the button and suggestions.

**Key Features:**
- Shows "Get More Suggestions" button when no suggestions exist
- Displays loading state during generation
- Shows generated suggestions as clickable word chips
- Provides "Refine" button to regenerate with user guidance
- Expandable details section showing reasoning for each suggestion

**Props Interface:**
```typescript
interface AdditionalSuggestionsProps {
  suggestions: WordSuggestion[];      // Array of word suggestions
  isLoading: boolean;                 // Loading state
  onGenerate: () => void;             // Callback for initial generation
  onRegenerate: (guidance: string) => void;  // Callback for refinement
  onWordClick: (word: string) => void; // Callback when user clicks a word
}
```

**WordSuggestion Interface:**
```typescript
export interface WordSuggestion {
  word: string;           // The suggested word/phrase
  reasoning: string;       // Explanation for the suggestion
  register: string;       // Register (formal, neutral, informal, poetic, etc.)
  literalness: number;    // Literalness score (0-1)
}
```

**UI States:**
1. **Empty State:** Shows "Get More Suggestions" button with description
2. **Loading State:** Shows spinner with "Generating suggestions..." message
3. **Populated State:** Shows suggestions grid with:
   - Header with count badge
   - "Refine" button
   - Info banner explaining the feature
   - Word chips (clickable)
   - Expandable reasoning details

**Key UI Elements:**
- Button with `RefreshCw` icon
- Badge showing suggestion count
- Info banner with blue background
- Word chips with hover effects
- Details/summary for reasoning

### 2. Integration: `WordGrid.tsx`

**Location:** `translalia-web/src/components/workshop-rail/WordGrid.tsx`

**Integration Point:**
```typescript
<AdditionalSuggestions
  suggestions={additionalSuggestions}
  isLoading={isLoadingSuggestions}
  onGenerate={() => generateAdditionalSuggestions()}
  onRegenerate={(guidance) => generateAdditionalSuggestions(guidance)}
  onWordClick={handleAdditionalWordClick}
/>
```

**State Management:**
```typescript
const [additionalSuggestions, setAdditionalSuggestions] = React.useState<WordSuggestion[]>([]);
const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(false);
```

**Key Functions:**

1. **`generateAdditionalSuggestions(userGuidance?: string)`**
   - Makes POST request to `/api/workshop/additional-suggestions`
   - Sends context: threadId, lineIndex, currentLine, previousLine, nextLine, fullPoem, poemTheme, userGuidance
   - Updates state with response suggestions
   - Handles errors gracefully

2. **`handleAdditionalWordClick(word: string)`**
   - Creates DragData object for the clicked word
   - Calls `appendToDraft()` from workshop store
   - Adds word to the current line's draft translation

**Context Data Sent:**
```typescript
{
  threadId: string,
  lineIndex: number,
  currentLine: string,        // The line being translated
  previousLine: string | null, // Previous line for flow/rhyme
  nextLine: string | null,    // Next line for flow/rhyme
  fullPoem: string,          // Complete poem text
  poemTheme: string | undefined, // Translation intent/theme
  userGuidance: string | null    // User's refinement guidance
}
```

### 3. API Endpoint: `additional-suggestions/route.ts`

**Location:** `translalia-web/src/app/api/workshop/additional-suggestions/route.ts`

**Method:** POST

**Authentication:** Requires authenticated user (via `requireUser()`)

**Request Schema (Zod):**
```typescript
const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  currentLine: z.string().min(1),
  previousLine: z.string().optional().nullable(),
  nextLine: z.string().optional().nullable(),
  fullPoem: z.string().min(1),
  poemTheme: z.string().optional(),
  userGuidance: z.string().optional().nullable(),
});
```

**Response Schema (Zod):**
```typescript
const SuggestionSchema = z.object({
  word: z.string().min(1),
  reasoning: z.string().min(1).optional().default(""),
  register: z.string().min(1).optional().default("neutral"),
  literalness: z.number().min(0).max(1).optional().default(0.5),
});

const ResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema).min(1),
});
```

**Processing Flow:**

1. **Validation:** Validates request body against schema
2. **Authorization:** Verifies thread ownership
3. **Data Extraction:**
   - Fetches thread from `chat_threads` table
   - Extracts `guideAnswers` from thread state (translation preferences)
   - Extracts `poemAnalysis` for source language
   - Determines target and source languages
4. **Prompt Building:** Calls `buildAdditionalWordSuggestionsPrompt()`
5. **LLM Call:**
   - Model: `gpt-4o-mini`
   - Temperature: `0.8` (for creativity)
   - Response format: `json_object`
6. **Response Processing:**
   - Parses JSON response
   - Validates against ResponseSchema
   - Sanitizes word suggestions (removes quotes, trailing punctuation)
   - Clamps to 7-9 suggestions (prefers 9 max)
   - Filters out empty words
7. **Return:** JSON with suggestions array

**Error Handling:**
- 400: Invalid request (validation failure)
- 404: Thread not found or unauthorized
- 500: AI response parsing/validation failure or generation error

**Word Sanitization:**
```typescript
function sanitizeSuggestedWord(raw: string): string {
  let w = raw.trim();
  w = w.replace(/^"+/, "").replace(/"+$/, "");  // Remove wrapping quotes
  w = w.replace(/["''"']+$/, "");                // Remove trailing quotes
  w = w.replace(/[,，]+$/, "");                  // Remove trailing commas
  return w.trim();
}
```

### 4. Prompt Builder: `workshopPrompts.ts`

**Location:** `translalia-web/src/lib/ai/workshopPrompts.ts`

**Function:** `buildAdditionalWordSuggestionsPrompt()`

**Signature:**
```typescript
export function buildAdditionalWordSuggestionsPrompt(params: {
  currentLine: string;
  lineIndex: number;
  previousLine?: string | null;
  nextLine?: string | null;
  fullPoem: string;
  poemTheme?: string;
  guideAnswers: unknown;
  userGuidance?: string | null;
  targetLanguage: string;
  sourceLanguage: string;
}): { system: string; user: string }
```

**System Prompt:**
```
You are a specialized poetry translation assistant generating additional word alternatives.

Your task: Provide 7-9 diverse, contextually-appropriate word suggestions for a specific line in a poem translation.

CRITICAL RULES:
- Consider the FULL POEM context
- Pay special attention to neighboring lines (previous and next) for flow and rhyme
- Respect the translator personality (domain, register, style)
- Generate words that fit the line's meaning and position in the poem
- Provide variety: different registers, synonyms, metaphors
- Return ONLY JSON format (no markdown, no explanations)
```

**User Prompt Structure:**

1. **Translator Personality Section:**
   - Approach summary
   - Domain
   - Register
   - Priority
   - Literalness score
   - Preferred terms (if any)
   - Forbidden terms (if any)

2. **Poem Context Section:**
   - Full poem text (source language)
   - Poem theme (if provided)

3. **Current Line Focus Section:**
   - Line number and text
   - Previous line (if exists) with flow/rhyme consideration note
   - Next line (if exists) with flow/rhyme consideration note
   - Special note if it's the opening line

4. **Task Section:**
   - Instruction to generate 7-9 word alternatives
   - User guidance (if provided for refinement)
   - Requirements:
     - Fit naturally in line's context
     - Consider rhyme/meter with neighboring lines
     - Vary suggestions (literal/metaphorical, different registers, synonyms)
     - Honor translator personality
     - Single token or short phrase (max 3 words)

5. **Output Format:**
```json
{
  "suggestions": [
    {
      "word": "palabra",
      "reasoning": "Literal translation, neutral register",
      "register": "neutral",
      "literalness": 0.9
    }
  ]
}
```

**Translator Personality Builder:**

The prompt uses `buildTranslatorPersonality()` from `translalia-web/src/lib/ai/translatorPersonality.ts` to extract:
- Domain (from `translationZone`)
- Purpose (from `translationIntent`)
- Priority (accuracy/naturalness/expressiveness)
- Literalness (0-100 scale)
- Register (array of style vibes)
- Sacred terms (must-keep words)
- Forbidden terms (no-go words)
- Source language variety

### 5. Refinement Dialog: `RegenerateGuidanceDialog.tsx`

**Location:** `translalia-web/src/components/workshop/RegenerateGuidanceDialog.tsx`

**Purpose:** Allows users to provide specific guidance for regenerating suggestions.

**Features:**
- Textarea for user guidance
- Placeholder with examples:
  - "Make them more archaic"
  - "Focus on internal rhyme"
  - "Use more metaphorical language"
  - "Suggest verbs instead of nouns"
  - "Make them more colloquial"
- Keyboard shortcut: Cmd/Ctrl + Enter to submit
- Loading state during regeneration

**Props:**
```typescript
interface RegenerateGuidanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegenerate: (guidance: string) => void;
  isLoading?: boolean;
}
```

**User Flow:**
1. User clicks "Refine" button
2. Dialog opens with textarea
3. User types guidance
4. User clicks "Regenerate" or presses Cmd/Ctrl + Enter
5. Dialog closes, `onRegenerate(guidance)` is called
6. Same API endpoint is called with `userGuidance` parameter

## Data Flow

### Initial Generation Flow

```
User clicks "Get More Suggestions"
  ↓
WordGrid.generateAdditionalSuggestions()
  ↓
POST /api/workshop/additional-suggestions
  {
    threadId, lineIndex, currentLine, previousLine, 
    nextLine, fullPoem, poemTheme, userGuidance: null
  }
  ↓
API: Fetch thread & guideAnswers
  ↓
API: buildAdditionalWordSuggestionsPrompt()
  ↓
API: OpenAI API call (gpt-4o-mini, temp=0.8)
  ↓
API: Parse & validate response
  ↓
API: Sanitize & clamp suggestions (7-9)
  ↓
API: Return { suggestions: [...] }
  ↓
WordGrid: setAdditionalSuggestions(data.suggestions)
  ↓
AdditionalSuggestions: Render word chips
```

### Refinement Flow

```
User clicks "Refine"
  ↓
RegenerateGuidanceDialog opens
  ↓
User types guidance (e.g., "Make them more archaic")
  ↓
User clicks "Regenerate" or Cmd/Ctrl+Enter
  ↓
WordGrid.generateAdditionalSuggestions(guidance)
  ↓
POST /api/workshop/additional-suggestions
  { ..., userGuidance: "Make them more archaic" }
  ↓
[Same API flow as above, but prompt includes user guidance]
  ↓
New suggestions replace old ones
```

### Word Selection Flow

```
User clicks a suggestion word
  ↓
WordGrid.handleAdditionalWordClick(word)
  ↓
Create DragData object:
  {
    id: `additional-${lineIndex}-${timestamp}-${word}`,
    text: word,
    dragType: "variantWord",
    sourceLineNumber: lineIndex,
    metadata: { source: "additional-suggestions" }
  }
  ↓
useWorkshopStore.appendToDraft(lineIndex, word)
  ↓
Word is appended to draft translation for that line
```

## State Management

### Workshop Store (`workshopSlice.ts`)

**Location:** `translalia-web/src/store/workshopSlice.ts`

**Relevant State:**
```typescript
draftLines: Record<number, string>;  // Line index -> draft text
currentLineIndex: number | null;      // Currently selected line
```

**Relevant Actions:**
```typescript
appendToDraft: (lineIndex: number, text: string) => void;
```

**Implementation:**
```typescript
appendToDraft: (lineIndex: number, text: string) => {
  const state = get();
  const currentDraft = state.draftLines[lineIndex] || "";
  set({
    draftLines: {
      ...state.draftLines,
      [lineIndex]: currentDraft + (currentDraft ? " " : "") + text,
    },
  });
}
```

### Local Component State

In `WordGrid.tsx`:
```typescript
const [additionalSuggestions, setAdditionalSuggestions] = React.useState<WordSuggestion[]>([]);
const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(false);
```

**State Lifecycle:**
- Suggestions are cleared when line changes
- Suggestions persist until:
  - User switches to a different line
  - User generates new suggestions (replaces old)
  - Component unmounts

## Type Definitions

### Core Types

**Location:** `translalia-web/src/types/workshop.ts`

```typescript
export interface AdditionalWordSuggestion {
  word: string;
  reasoning: string;
  register: "formal" | "neutral" | "informal" | "poetic" | "technical" | string;
  literalness: number; // 0-1 scale
}

export interface AdditionalSuggestionsState {
  suggestions: AdditionalWordSuggestion[];
  lineIndex: number | null;
  isLoading: boolean;
  lastUserGuidance: string | null;
}
```

**Note:** The `AdditionalSuggestionsState` interface exists in types but isn't used in the current implementation. The component uses local state instead.

### DragData Type

**Location:** `translalia-web/src/types/drag.ts`

When a word is clicked, it's converted to `DragData`:
```typescript
interface DragData {
  id: string;
  text: string;
  originalWord: string;
  partOfSpeech: string;
  sourceLineNumber: number;
  position: number;
  dragType: "variantWord" | "sourceWord" | ...;
  metadata?: {
    source?: "additional-suggestions" | ...;
  };
}
```

## User Interactions

### 1. Generate Initial Suggestions

**Trigger:** Click "Get More Suggestions" button

**Visual Feedback:**
- Button disappears
- Loading spinner appears
- "Generating suggestions..." message

**Result:**
- 7-9 word suggestions appear as clickable chips
- Header shows count badge
- "Refine" button appears
- Info banner explains feature

### 2. Click a Suggestion Word

**Trigger:** Click any word chip

**Action:**
- Word is appended to the current line's draft translation
- Word appears in the notebook/editor for that line

**Visual Feedback:**
- Word chip has hover effect (border, shadow)
- Tooltip shows reasoning on hover

### 3. Refine Suggestions

**Trigger:** Click "Refine" button

**Flow:**
1. Dialog opens
2. User types guidance
3. User submits (button or Cmd/Ctrl+Enter)
4. Dialog closes
5. Loading state shows
6. New suggestions replace old ones

**Guidance Examples:**
- "Make them more archaic"
- "Focus on internal rhyme"
- "Use more metaphorical language"
- "Suggest verbs instead of nouns"
- "Make them more colloquial"

### 4. View Reasoning

**Trigger:** Click "View reasoning for suggestions" (expandable details)

**Result:**
- Expands to show reasoning for each suggestion
- Format: `word: reasoning`

## Error Handling

### API Errors

**400 Bad Request:**
- Invalid request schema
- Returns: `{ error: "Invalid request", details: validation.error.issues }`

**404 Not Found:**
- Thread not found or user doesn't own thread
- Returns: `{ error: "Thread not found or unauthorized" }`

**500 Internal Server Error:**
- JSON parse failure
- Response validation failure
- OpenAI API error
- Returns: `{ error: "Failed to generate suggestions", details: error.message }`

### Client-Side Error Handling

In `WordGrid.tsx`:
```typescript
try {
  // API call
} catch (error) {
  console.error("[WordGrid] Error generating suggestions:", error);
  // Error is logged, loading state is cleared
  // User can retry
}
```

**User Experience:**
- Errors are logged to console
- Loading state is cleared
- User can retry by clicking button again
- No error toast/notification (could be improved)

## Configuration

### Model Configuration

**Model:** `gpt-4o-mini`
- Chosen for cost-effectiveness
- Sufficient quality for word suggestions
- Fast response time

**Temperature:** `0.8`
- Higher temperature for creativity
- Allows diverse suggestions
- Balances variety with coherence

**Response Format:** `json_object`
- Ensures structured output
- Easier parsing and validation

### Suggestion Limits

- **Minimum:** 7 suggestions
- **Maximum:** 9 suggestions (preferred)
- **Clamping:** API clamps to 9 if more are returned

### Word Length Limits

- **Max phrase length:** 3 words
- **Sanitization:** Removes quotes, trailing punctuation

## Related Features

### 1. Line Translation Variants

The suggestions appear below the 3 main translation variants for each line. They complement the variants by providing individual word alternatives.

### 2. Notebook/Draft System

When a suggestion is clicked, it's added to the draft translation via `appendToDraft()`, which is part of the unified draft system.

### 3. Translator Personality

The suggestions respect the translator personality built from guide answers:
- Translation zone (domain)
- Translation intent (purpose)
- Literalness preference
- Register preferences
- Sacred/forbidden terms

### 4. Context Awareness

The feature uses:
- **Line context:** Previous and next lines for flow/rhyme
- **Poem context:** Full poem for thematic consistency
- **Position awareness:** Special handling for opening/closing lines

## Performance Considerations

### API Call Optimization

- **Model choice:** `gpt-4o-mini` is faster and cheaper than `gpt-4o`
- **Caching:** No caching currently (could cache per line/context hash)
- **Debouncing:** No debouncing (user can spam clicks - could be improved)

### State Management

- Suggestions are stored in component state (not persisted)
- Cleared on line change (prevents stale data)
- No memory leaks (React state cleanup)

### UI Performance

- Word chips use simple button elements (lightweight)
- Expandable details use native `<details>` element
- No virtual scrolling needed (typically 7-9 items)

## Future Improvements

### Potential Enhancements

1. **Caching:**
   - Cache suggestions per line/context hash
   - Reduce API calls for same line

2. **Error UI:**
   - Show error toast/notification
   - Retry button in error state

3. **Debouncing:**
   - Prevent rapid-fire API calls
   - Debounce button clicks

4. **Persistence:**
   - Save suggestions to thread state
   - Restore on page reload

5. **Analytics:**
   - Track which suggestions are clicked
   - Improve prompt based on usage

6. **Batch Generation:**
   - Generate suggestions for multiple lines at once
   - Bulk refinement

7. **Suggestion Filtering:**
   - Filter by register
   - Filter by literalness
   - Search suggestions

## Testing Considerations

### Unit Tests Needed

1. **Component Tests:**
   - `AdditionalSuggestions` renders correctly in all states
   - Button click triggers `onGenerate`
   - Word click triggers `onWordClick`
   - Refine dialog opens/closes correctly

2. **API Tests:**
   - Request validation
   - Authorization checks
   - Response parsing and sanitization
   - Error handling

3. **Integration Tests:**
   - Full flow from button click to word selection
   - Refinement flow
   - State updates correctly

### Manual Testing Checklist

- [ ] Generate suggestions for first line
- [ ] Generate suggestions for middle line
- [ ] Generate suggestions for last line
- [ ] Click suggestion word (adds to draft)
- [ ] Refine with guidance
- [ ] Switch lines (suggestions clear)
- [ ] Error handling (invalid thread, API failure)
- [ ] Loading states
- [ ] Keyboard shortcuts (Cmd/Ctrl+Enter)

## Summary

The "Get More Suggestions" feature is a sophisticated, context-aware word suggestion system that:

1. **Generates 7-9 word alternatives** for a specific line in a poem translation
2. **Considers full context:** poem, neighboring lines, translator personality
3. **Allows refinement:** users can provide guidance to improve suggestions
4. **Integrates seamlessly:** words can be clicked to add to draft translation
5. **Uses efficient AI:** `gpt-4o-mini` with temperature 0.8 for creativity
6. **Provides transparency:** shows reasoning for each suggestion

The feature enhances the translation workflow by providing additional word choices beyond the 3 main translation variants, helping users find the perfect word for their poetic translation.
