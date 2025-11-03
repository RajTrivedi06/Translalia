# COMPREHENSIVE CODEBASE ANALYSIS: TRANSLALIA
## Complete Guide to AIDCPT App Structure & Implementation Patterns

**Project**: Translalia - A decolonial, AI-assisted creative poetry translation workspace
**Analysis Date**: 2025-10-26
**Technology Stack**: Next.js 15.4.6, React 19, TypeScript, Zustand, TanStack Query, OpenAI, Supabase

---

## TABLE OF CONTENTS
1. [Codebase Overview](#codebase-overview)
2. [Project Structure](#project-structure)
3. [Technology Stack](#technology-stack)
4. [Text & Content Handling](#text--content-handling)
5. [Feature Implementations](#feature-implementations)
6. [Configuration & Constants](#configuration--constants)
7. [Modification Areas & Roadmap](#modification-areas--roadmap)

---

## CODEBASE OVERVIEW

### What is Translalia?
A Next.js web application that guides poets through decolonial poetry translation using AI assistance. Users:
1. Upload a poem in a source language
2. Answer guide questions about translation intent, target audience, style, and constraints
3. Use the Workshop to generate word-by-word translation options
4. Assemble translations in the Notebook by selecting word options
5. Review completed translations with comparison views
6. Reflect on their translation journey and process

### Key Stats
- **200+ TypeScript/TSX files**
- **40+ API endpoints**
- **100+ React components** (29 notebook-focused, 30+ workspace, 9+ UI primitives)
- **15+ custom hooks**
- **37+ utility modules**
- **Monorepo**: Single-app structure with root documentation

---

## PROJECT STRUCTURE

### Directory Hierarchy

```
/Users/raaj/Documents/CS/metamorphs/
├── README.md                                    # Repo overview
├── package.json                                 # Minimal root deps
├── .git/
├── .claude/                                     # Claude Code config
├── _docs/                                       # Repository-level docs
│   └── [style guides, contributor guidelines]
└── metamorphs-web/                              # Main Next.js application
    ├── src/
    ├── docs/
    ├── public/
    ├── package.json                            # All app dependencies
    ├── next.config.ts
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── middleware.ts
    └── README.md
```

### Key Source Directory Structure

```
src/
├── app/                                        # Next.js App Router
│   ├── (app)/                                  # Protected auth routes (layout group)
│   │   ├── workspaces/[projectId]/threads/[threadId]/
│   │   │   ├── page.tsx                       # Main interface
│   │   │   └── ThreadPageClient.tsx
│   │   ├── account/
│   │   └── [other protected routes]
│   ├── auth/                                   # Public auth routes
│   ├── api/                                    # RESTful API routes (40+ endpoints)
│   │   ├── workshop/                          # Workshop operations
│   │   ├── guide/                             # Guide analysis
│   │   ├── journey/                           # Journey tracking
│   │   ├── notebook/                          # Notebook operations
│   │   ├── chat/                              # Messaging
│   │   └── [other API routes]
│   ├── layout.tsx                             # Root layout
│   ├── page.tsx                               # Landing page
│   └── globals.css
├── components/                                 # React components (feature-first)
│   ├── notebook/                              # Notebook/cell UI (29 files)
│   ├── workspace/                             # Main workspace UI (30+ files)
│   ├── ui/                                    # shadcn-style primitives
│   ├── chat/                                  # Chat components
│   ├── guide/                                 # Guide UI
│   └── [other feature components]
├── hooks/                                      # Custom React hooks (15+ files)
├── lib/                                        # Utility libraries
│   ├── ai/                                    # LLM integration
│   ├── auth/                                  # Authentication
│   ├── hooks/                                 # Additional hooks
│   ├── i18n/                                  # Internationalization
│   ├── interview/                             # Interview flow
│   ├── notebook/                              # Notebook utilities
│   ├── workshop/                              # Workshop utilities
│   ├── models.ts                             # LLM model constants
│   ├── featureFlags.ts                       # Feature flag evaluation
│   └── [other utilities]
├── server/                                     # Server-side utilities
│   ├── guide/                                 # Guide logic
│   └── [other server modules]
├── store/                                      # Zustand state stores
│   ├── workspace.ts                           # Main workspace store
│   ├── workshopSlice.ts                       # Workshop state
│   ├── notebookSlice.ts                       # Notebook state
│   └── guideSlice.ts                          # Guide/interview state
├── state/                                      # Additional client state
├── types/                                      # TypeScript type definitions
│   ├── workspace.ts
│   ├── notebook.ts
│   ├── workshop.ts
│   └── [other types]
├── providers.tsx                               # React Query + Supabase setup
└── [config files]
```

---

## TECHNOLOGY STACK

### Core Framework
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15.4.6 | App Router, SSR, API routes |
| React | 19.1.0 | UI library |
| TypeScript | 5.x | Type safety (strict mode) |

### State Management
| Technology | Version | Purpose |
|-----------|---------|---------|
| Zustand | 5.0.7 | Lightweight client state |
| TanStack Query | 5.85.3 | Server state caching & fetching |

### Authentication & Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Supabase | 2.55.0 | Auth + SSR integration |
| Supabase SSR | 0.5.0 | Middleware cookie handling |

### AI/LLM
| Technology | Version | Purpose |
|-----------|---------|---------|
| OpenAI | 4.104.0 | LLM API calls (responses, embeddings) |

**Models Used**:
- `gpt-5`: Translator (main option generation)
- `gpt-5-mini`: Enhancer (reflections, suggestions)
- `gpt-5-nano-2025-08-07`: Router (intent classification)
- `text-embedding-3-large`: Embeddings (semantic search)

### UI & Styling
| Technology | Version | Purpose |
|-----------|---------|---------|
| Tailwind CSS | 3.4.17 | Utility-first CSS |
| Lucide React | 0.539.0 | Icon library |
| shadcn/ui | Custom | Component library |

**Component Primitives** (Radix UI):
- Button, Card, Dialog, Sheet, Badge, Separator, Input, Textarea

### Interaction & Visualization
| Technology | Version | Purpose |
|-----------|---------|---------|
| dnd-kit | 6.3.1 + utilities | Drag & drop |
| Reactflow | 11.11.4 | Graph visualization |
| react-resizable-panels | 3.0.4 | Resizable pane layout |

### Validation & Utilities
| Technology | Version | Purpose |
|-----------|---------|---------|
| Zod | 3.25.76 | Runtime schema validation |
| clsx | 2.1.1 | Conditional classNames |
| tailwind-merge | 3.3.1 | Intelligent CSS merging |

### Development
| Technology | Version | Purpose |
|-----------|---------|---------|
| ESLint | 9 | Code linting |
| PostCSS | 8.5.6 | CSS processing |
| Autoprefixer | 10.4.21 | CSS vendor prefixes |

---

## TEXT & CONTENT HANDLING

### Text Processing Pipeline

```
Input: Poem Text (raw)
  ↓
[Split by \n, trim, filter empty]  →  Array of poem lines
  ↓
Stored in: poemLines (WorkshopStore)
  ↓
For each line:
  [Split by /\s+/, filter]  →  Word tokens
  ↓
Generate 3 options per word via OpenAI
  ↓
User selects from word options
  ↓
[Join selected words]  →  CompiledLine
  ↓
[Compiled translations auto-saved]
  ↓
Output: Full poem translation
```

### Line Splitting Logic
**File**: [WorkshopRail.tsx:34-39](metamorphs-web/src/components/workshop-rail/WorkshopRail.tsx#L34-L39)
```typescript
const lines = poem.text
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);
```

### Word Tokenization
**File**: [generate-options/route.ts:102-109](metamorphs-web/src/app/api/workshop/generate-options/route.ts#L102-L109)
```typescript
const words = lineText.split(/\s+/).filter(Boolean);
```

### Syllable Calculation
**File**: [syllables.ts:1-33](metamorphs-web/src/lib/workshop/syllables.ts#L1-L33)
- Counts vowel groups: [aeiouy]+
- Adjusts for silent 'e' at end
- Returns minimum of 1 syllable per word

### Text Display Component Hierarchy

| Component | File | Purpose |
|-----------|------|---------|
| **CellBody** | [CellBody.tsx:41](metamorphs-web/src/components/notebook/CellBody.tsx#L41) | Display source text + translation textarea |
| **PoemAssembly** | [PoemAssembly.tsx:388-402](metamorphs-web/src/components/notebook/PoemAssembly.tsx#L388-L402) | Side-by-side source & translation grid |
| **ComparisonView** | [ComparisonView.tsx:396-428](metamorphs-web/src/components/notebook/ComparisonView.tsx#L396-L428) | Split-screen with sync scrolling |
| **LineSelector** | [LineSelector.tsx:27](metamorphs-web/src/components/workshop-rail/LineSelector.tsx#L27) | Line preview in workshop |

### Data Structures

#### NotebookCell Type
**File**: [types/notebook.ts](metamorphs-web/src/types/notebook.ts)
```typescript
interface NotebookCell {
  id: string;
  lineIndex: number;
  source: {
    text: string;          // Original poem line
    language: string;
    dialect?: string;
  };
  translation: {
    text: string;          // Translated text
    status: CellStatus;    // 'untranslated' | 'draft' | 'reviewed' | 'locked'
    lockedWords: number[];
  };
  notes: string[];
  footnotes: Array<{ word: string; note: string }>;
  prismaticVariants?: Array<{
    label: 'A' | 'B' | 'C';
    text: string;
    rationale: string;
    confidence: number;
  }>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    wordCount: number;
  };
}
```

#### WorkshopLine Type
**File**: [types/workshop.ts](metamorphs-web/src/types/workshop.ts)
```typescript
interface WorkshopLine {
  original: string;
  translated: string;
  selections: Record<number, string>;  // position → selected word
  completedAt: string;
}

interface Token {
  id: string;
  original: string;
  literalMeaning: string;
  grammarTag: string;
  options: TokenOption[];  // 3 options per word
}

interface TokenOption {
  id: string;
  text: string;
  registerTag: string;
  confidence: "high" | "medium" | "low";
  note?: string;
}
```

### UI Strings (Hardcoded)

**GuideRail Component** [GuideRail.tsx:262-597](metamorphs-web/src/components/guide/GuideRail.tsx#L262-L597)
- "Your poem"
- "Translation intent"
- "Start Workshop"
- "Clear inputs"

**Notebook Toolbar** [NotebookToolbar.tsx:23-64](metamorphs-web/src/components/notebook/NotebookToolbar.tsx#L23-L64)
- "Notebook", "Prismatic", "Line numbers"
- Filter buttons: "all", "untranslated", "needs_review", "locked", "with_notes"

**Cell Components**
- [CellHeader.tsx:17](metamorphs-web/src/components/notebook/CellHeader.tsx#L17): "Line {n}" label
- [CellFooter.tsx:25-36](metamorphs-web/src/components/notebook/CellFooter.tsx#L25-L36): "Lock", "Prismatic", "Bias Check", "Add Note"

**PoemAssembly Display** [PoemAssembly.tsx:301-578](metamorphs-web/src/components/notebook/PoemAssembly.tsx#L301-L578)
- "Assembled Translation"
- "lines completed"
- "Copy", "Export TXT", "Print/PDF"

**Status Badges**
- "Complete" / "Pending" / "[Not yet translated]"
- "Translation complete!" (success)

---

## FEATURE IMPLEMENTATIONS

### 1. WORKSHOP FEATURE

#### How It Generates Alternatives

**Route**: [POST /api/workshop/generate-options](metamorphs-web/src/app/api/workshop/generate-options/route.ts)

**Flow**:
1. **Accept request** with `threadId`, `lineIndex`, `lineText`
2. **Fetch thread state** from database (includes `guide_answers`)
3. **Tokenize line** (split by whitespace)
4. **Build system + user prompts** from guide answers + line context
5. **Call OpenAI** with `TRANSLATOR_MODEL` (gpt-5, fallback gpt-4o)
6. **Parse JSON response** with options for each word
7. **Validate response** (ensure 3 options per word, fallback if needed)
8. **Cache result** (TTL 1 hour, key: `workshop:${threadId}:line:${lineIndex}`)
9. **Return options** with part-of-speech tags

**Model Configuration**:
- **TRANSLATOR_MODEL**: `gpt-5` (env override in `.env.local`)
- **Fallback**: If model not found, uses `gpt-4o`
- **GPT-5 handling**: Removes unsupported params (temperature, top_p, frequency_penalty)

**Response Schema**:
```typescript
{
  original: string;
  position: number;
  options: string[];  // Exactly 3 options
  partOfSpeech?: "NOUN" | "VERB" | "ADJ" | "ADV" | ...
}
```

**Prompt Building** [workshopPrompts.ts:1-80](metamorphs-web/src/lib/ai/workshopPrompts.ts#L1-L80)
- Extracts guide answers (translation intent, target language, style, stance, policy, form)
- Builds instruction lines from structured answers
- Maps: `closeness: { close, in_between, natural }` → instruction text
- Requests 3 options spanning literal→creative spectrum
- Uses JSON schema for deterministic output

#### Syllable Calculation

**Algorithm** [syllables.ts:1-33](metamorphs-web/src/lib/workshop/syllables.ts#L1-L33):
1. Words ≤ 3 chars = 1 syllable
2. Count vowel groups: `/[aeiouy]+/g`
3. Adjust for silent 'e' at end: `word.endsWith("e") && syllableCount > 1 → syllableCount--`
4. Return `Math.max(syllableCount, 1)`

### 2. TRANSLATION BUILDING

#### Word Selection & Compilation

**Route**: [POST /api/workshop/save-line](metamorphs-web/src/app/api/workshop/save-line/route.ts)

**Process**:
1. **Accept request** with `threadId`, `lineIndex`, `selections` (array of position→word mappings)
2. **Sort selections** by position
3. **Join words**: `selections.map(s => s.selectedWord).join(" ")`
4. **Create WorkshopLine** object with metadata (timestamp, model used)
5. **Update thread state** in database: `workshop_lines[lineIndex] = WorkshopLine`
6. **Auto-save** debounced (3 second debounce in NotebookPhase6)

**Storage**:
- **Database**: `chat_threads.state.workshop_lines: Record<number, WorkshopLine>`
- **Client**: Zustand store `workshopSlice.completedLines`
- **LocalStorage**: Thread-aware storage via `threadStorage`

#### Final Assembly Flow

[NotebookPhase6.tsx:127-142](metamorphs-web/src/components/notebook/NotebookPhase6.tsx#L127-L142):
```
User drops cells → NotebookDropZone
  ↓
Extract translation.text from each dropped cell
  ↓
Join with space: `droppedCells.map(c => c.translation.text).join(" ")`
  ↓
Store as draft translation
  ↓
User confirms → Finalize in notebook
```

### 3. JOURNEY TRACKING

#### List Journey Items

**Route**: [GET /api/journey/list](metamorphs-web/src/app/api/journey/list/route.ts)

- Query: `projectId`, `limit` (default 20, max 50)
- Fetches: `journey_items` table (descending by `created_at`)
- Returns: `[{id, kind, summary, meta, created_at}, ...]`

#### Generate Reflection

**Route**: [POST /api/journey/generate-reflection](metamorphs-web/src/app/api/journey/generate-reflection/route.ts)

**Context Collected**:
- Poem source lines
- Completed translations per line
- Translation intent + target language
- Total progress percentage

**System Prompt** [journeyPrompts.ts](NOT YET ANALYZED):
- Reflects on translator's creative choices
- Analyzes patterns in approach
- Highlights growth throughout translation
- **NOT** a quality comparison

**Model**: `ENHANCER_MODEL` (`gpt-5-mini`, fallback `gpt-4o-mini`)

**Response Schema**:
```typescript
{
  summary: string;
  insights: string[];
  strengths: string[];
  challenges: string[];
  recommendations: string[];
  overallAssessment: string;
}
```

### 4. LLM RESPONSE PROCESSING

**File**: [openai.ts:189-225](metamorphs-web/src/lib/ai/openai.ts#L189-L225)

**JSON Parsing**:
```typescript
const text = completion.choices[0]?.message?.content ?? "{}";
const parsed = JSON.parse(text);

// Handle both formats:
// 1. { options: [...], partOfSpeech: "..." }
// 2. [option1, option2, option3]

if (parsed.options && Array.isArray(parsed.options)) {
  options = parsed.options;
  partOfSpeech = parsed.partOfSpeech || "neutral";
} else if (Array.isArray(parsed)) {
  options = parsed;
  partOfSpeech = "neutral";
}
```

**Error Handling**:
- Catch JSON parse errors
- Fallback to safe defaults: `[word, "${word} (literal)", "${word} (alt)"]`
- Pad with empty strings if < 3 options
- Trim to 3 if > 3 options

**Validation**:
- Zod schemas for request/response validation
- API guard middleware for auth
- Rate limiting per thread (10 req/min)

### 5. WORD LABELING (Current)

**Word Count Labels** [TranslationCell.tsx:125-127](metamorphs-web/src/components/notebook/TranslationCell.tsx#L125-L127)
- Format: `{wordCount}w` (e.g., "3w" for 3-word translation)
- Displayed as badge in arrange mode

**Position Labels** [WordGridOptimized.tsx:84-91](metamorphs-web/src/components/notebook/WordGridOptimized.tsx#L84-L91)
- Shows word position (e.g., "1", "2", "3")
- Used for tracking during word selection

### 6. STATE PERSISTENCE

#### Thread-Aware Storage

**File**: [threadStorage.ts:25-44](metamorphs-web/src/lib/threadStorage.ts#L25-L44)

- Keys prefixed by threadId: `${storeName}:${threadId}`
- Thread ID extracted from:
  1. `activeThreadId` (programmatically set)
  2. URL pathname: `/threads/[threadId]`
  3. Fallback: `last-thread-id` from localStorage

#### Workshop State Persistence

**File**: [workshopSlice.ts:78-184](metamorphs-web/src/store/workshopSlice.ts#L78-L184)

- **Storage**: `threadStorage` with key `workshop-storage`
- **Persisted Fields**:
  - `meta: { threadId }`
  - `poemLines: string[]`
  - `completedLines: Record<number, string>`
  - `selectedLineIndex: number | null`
  - `modelUsed: string`

#### Notebook State Persistence

**File**: [notebookSlice.ts:132-464](metamorphs-web/src/store/notebookSlice.ts#L132-L464)

- **Storage**: `threadStorage` with key `notebook-storage`
- **Persisted Fields**:
  - `focusedCellIndex`
  - `view: { showPrismatic, showLineNumbers, compareMode }`
  - `filter: NotebookFilter`
- **Draft Translations**: Map<lineIndex, translation> (in-memory, auto-saved)

**Auto-Save Hook** [NotebookPhase6.tsx:144-161](metamorphs-web/src/components/notebook/NotebookPhase6.tsx#L144-L161)
- Debounce: 3000ms
- Calls: `updateNotebookCell(threadId, lineIndex, translation)`

#### Database Persistence

**Route**: [PUT /api/notebook/cells/[cellId]](metamorphs-web/src/app/api/notebook/cells/[cellId]/route.ts)

```typescript
await supabase
  .from("chat_threads")
  .update({
    state: {
      ...currentState,
      workshop_lines: updatedWorkshopLines,
      notebook_cells: updatedNotebookCells,
    },
  })
  .eq("id", threadId);
```

**Undo/Redo History**

**File**: [historyManager.ts](metamorphs-web/src/lib/notebook/historyManager.ts)
- Max history size: 20 entries
- Stores: dropped cells array + timestamp
- Methods: `push()`, `undo()`, `redo()`, `reset()`

---

## CONFIGURATION & CONSTANTS

### Environment Variables

**Location**: `/metamorphs-web/.env.local` or `.env.example`

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# OpenAI
OPENAI_API_KEY=sk-...

# Feature Flags
NEXT_PUBLIC_FEATURE_TRANSLATOR=1
NEXT_PUBLIC_FEATURE_ENHANCER=1
NEXT_PUBLIC_FEATURE_PRISMATIC=1
NEXT_PUBLIC_FEATURE_VERIFY=1
NEXT_PUBLIC_FEATURE_BACKTRANSLATE=1
NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT=1
NEXT_PUBLIC_FEATURE_CHAT_UI_ONLY=0

# Model Configuration
TRANSLATOR_MODEL=gpt-5
ENHANCER_MODEL=gpt-5-mini
ROUTER_MODEL=gpt-5-nano-2025-08-07
EMBEDDINGS_MODEL=text-embedding-3-large

# Other
NEXT_PUBLIC_UI_LANG_DEFAULT=en
NEXT_PUBLIC_ENABLE_PASSWORD_AUTH=false
DEBUG_PROMPTS=0
RATE_LIMIT_ENFORCE=1
```

### Feature Flags

**File**: [featureFlags.ts:1-15](metamorphs-web/src/lib/featureFlags.ts#L1-L15)

```typescript
export function isEnhancerEnabled() { return process.env.NEXT_PUBLIC_FEATURE_ENHANCER === "1"; }
export function isTranslatorEnabled() { return process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR === "1"; }
export function isSidebarLayoutEnabled() { return process.env.NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT === "1"; }
export function inProd() { return process.env.NODE_ENV === "production"; }
export function inDev() { return !inProd(); }
```

### Language Configuration

**File**: [i18n/config.ts](metamorphs-web/src/lib/i18n/config.ts)
```typescript
export function getDefaultUiLang() {
  return process.env.NEXT_PUBLIC_UI_LANG_DEFAULT ?? "en";
}
```

**File**: [i18n/targetLanguage.ts](metamorphs-web/src/lib/i18n/targetLanguage.ts)
```typescript
export type TLInfo = {
  target: string;
  dialect?: string;
  translanguaging?: boolean;
};

// Extract from guide answers fields: "TARGET_LANGUAGE", "target_language", etc.
// Default: "English (diaspora; keep marked words verbatim)"
```

### Model Configuration

**File**: [models.ts:1-12](metamorphs-web/src/lib/models.ts#L1-L12)

```typescript
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL || "gpt-5";
export const ENHANCER_MODEL = process.env.ENHANCER_MODEL || "gpt-5-mini";
export const ROUTER_MODEL = process.env.ROUTER_MODEL || "gpt-5-nano-2025-08-07";
export const EMBEDDINGS_MODEL = process.env.EMBEDDINGS_MODEL || "text-embedding-3-large";
```

### Database Schema

**Thread State Structure** (stored in `chat_threads.state` jsonb column)

```typescript
{
  poem_analysis: {
    source_lines: string[];
    language: string;
    dialect?: string;
    wordCount: number;
    tone: string[];
    themes: string[];
  },

  guide_answers: {
    translationIntent?: string;
    targetLanguage?: { lang, variety, script };
    audience?: { audience, goal[] };
    stance?: { closeness };
    style?: { vibes[] };
    policy?: { must_keep[], no_go[] };
    form?: { line_breaks, rhyme, line_length };
  },

  workshop_lines: {
    [lineIndex]: {
      original: string;
      translated: string;
      selections: { position: number; selectedWord: string }[];
      completedAt: string;
    }
  },

  notebook_cells: {
    [lineIndex]: {
      translation: { text: string; status: string };
      notes: string[];
      metadata: { lastUpdated: string };
    }
  }
}
```

### Interview Schema

**File**: [interview/schema.ts:3-31](metamorphs-web/src/lib/interview/schema.ts#L3-L31)

```typescript
export const InterviewFieldsSchema = z.object({
  target_language: z.string(),
  dialect_or_register: z.string().optional(),
  tone_style: z.string().optional(),
  constraints: z.string().optional(),
  glossary: z.array(z.object({
    term: string;
    translation: string;
    note?: string;
    dialect_marker?: string;
    source?: string;
  })).optional(),
});

// Gap detection for missing fields
export type InterviewGap =
  | "target_language"
  | "dialect_or_register"
  | "tone_style"
  | "glossary_missing"
  | "glossary_ambiguous";
```

---

## MODIFICATION AREAS & ROADMAP

### MODIFICATION 1: Add Language Selector

**Objective**: Allow users to select UI language

**Files to Create**:
1. [NEW] `/src/lib/i18n/languages.ts`
   - Define: `SUPPORTED_LANGUAGES = ["en", "es", "fr", "ar", ...]`
   - Define: `LANGUAGE_LABELS = {en: "English", es: "Español", ...}`

2. [NEW] `/src/components/ui/LanguageSelector.tsx`
   - Dropdown/button group component
   - Props: `currentLang: string`, `onChange: (lang: string) => void`
   - Render language options

**Files to Modify**:
1. [MODIFY] [lib/i18n/config.ts](metamorphs-web/src/lib/i18n/config.ts)
   - Add: `getSupportedLanguages()` function
   - Add: `getLanguageLabel(code: string)` function

2. [MODIFY] [app/layout.tsx](metamorphs-web/src/app/layout.tsx)
   - Import LanguageSelector
   - Add to header/nav
   - Store selection in cookie/localStorage
   - Pass to providers

3. [MODIFY] [store/guideSlice.ts](metamorphs-web/src/store/guideSlice.ts)
   - Add: `selectedLanguage?: string` to GuideAnswers
   - Add action: `setSelectedLanguage(lang: string)`

---

### MODIFICATION 2: Split Translation Intent into Two Fields

**Current**: Single `translationIntent` field
**Target**: Two fields: `translationZone` (context) + `translationIntent` (specific intent)

**Files to Modify**:

1. [MODIFY] [store/guideSlice.ts:45-84](metamorphs-web/src/store/guideSlice.ts#L45-L84)
   ```typescript
   // FROM:
   translationIntent: { text: string | null; isSubmitted: boolean };

   // TO:
   translationZone: { text: string | null; isSubmitted: boolean };
   translationIntent: { text: string | null; isSubmitted: boolean };
   ```
   - Add actions: `setTranslationZone()`, `submitTranslationZone()`

2. [MODIFY] [store/guideSlice.ts:7-26](metamorphs-web/src/store/guideSlice.ts#L7-L26) - GuideAnswers interface
   - Add: `translationZone?: string | null`
   - Keep: `translationIntent?: string | null`

3. [MODIFY] [lib/interview/schema.ts](metamorphs-web/src/lib/interview/schema.ts)
   - Add: `translation_zone: z.string().optional()`

4. [MODIFY] [components/guide/GuideRail.tsx](metamorphs-web/src/components/guide/GuideRail.tsx)
   - Extract both from store (Lines 63-65)
   - Add two separate textarea inputs (distinct labels/placeholders)
   - Add handlers: `handleTranslationZoneSave()`, `handleTranslationIntentSave()`

5. [MODIFY] [lib/ai/workshopPrompts.ts:16-24](metamorphs-web/src/lib/ai/workshopPrompts.ts#L16-L24)
   - Update `collectPreferenceLines()` to handle both fields
   - Prioritize: intent > zone > structured fields

6. [MODIFY] [app/api/workshop/generate-options/route.ts:98](metamorphs-web/src/app/api/workshop/generate-options/route.ts#L98)
   - Pass both `translationZone` and `translationIntent` to prompts

---

### MODIFICATION 3: Remove Word Labels (1w, 2w, etc.)

**Current**: Words labeled with count (e.g., "3w" for 3-word translation)
**Target**: Remove label display

**Files to Modify**:

1. [MODIFY] [components/notebook/TranslationCell.tsx:125-127](metamorphs-web/src/components/notebook/TranslationCell.tsx#L125-L127)
   - **REMOVE** badge with `{wordCount}w` label
   ```typescript
   // DELETE THESE LINES:
   <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
     {wordCount}w
   </Badge>
   ```

2. [MODIFY] [components/notebook/WordGridOptimized.tsx:84-91](metamorphs-web/src/components/notebook/WordGridOptimized.tsx#L84-L91)
   - **REMOVE** position label display
   - Keep internal `position` field for word tracking (just don't render it)

3. [VERIFY] [components/notebook/NotebookCell.tsx](metamorphs-web/src/components/notebook/NotebookCell.tsx)
   - Check for other label references
   - Remove if found

4. [VERIFY] [components/notebook/ComparisonView.tsx](metamorphs-web/src/components/notebook/ComparisonView.tsx)
   - Check for label references
   - Remove if found

**Note**: Keep internal `position` and `wordCount` fields for functionality; just don't render them as UI labels.

---

### MODIFICATION 4: Make Translation Zone/Intent Updatable

**Current**: Can set once, then locked
**Target**: Allow editing after submission

**Files to Modify**:

1. [MODIFY] [components/guide/GuideRail.tsx](metamorphs-web/src/components/guide/GuideRail.tsx)
   - Add state: `isEditingZone: boolean`, `isEditingIntent: boolean`
   - Add toggle buttons: "Edit" → "Save" → "Done"
   - Keep textareas visible and editable in both states
   - Call mutation on save

2. [VERIFY] [lib/hooks/useGuideFlow.ts](metamorphs-web/src/lib/hooks/useGuideFlow.ts)
   - Already has `useSaveAnswer()` for updates
   - Just call with new values on save

3. [VERIFY] [server/guide/updateGuideState.ts](metamorphs-web/src/server/guide/updateGuideState.ts)
   - Lines 66-136: `updateGuideState()` already supports partial updates
   - No changes needed

4. [MODIFY] [lib/ai/workshopPrompts.ts](metamorphs-web/src/lib/ai/workshopPrompts.ts)
   - Invalidate prompt cache on intent change
   - Consider regenerating word options with new intent

---

### MODIFICATION 5: Enable Source Text Dragging in Workshop

**Current**: Source text is display-only
**Target**: Allow dragging source text into translation field

**Files to Create**:
1. [NEW] `/src/components/workshop/SourceTextPanel.tsx`
   - Display source text with drag capability
   - Highlight on drag
   - Emit drag events

**Files to Modify**:

1. [MODIFY] [store/workshopSlice.ts:24-65](metamorphs-web/src/store/workshopSlice.ts#L24-L65)
   - Add: `selectedSourceText?: string`
   - Add: `draggedSourceLineIndex?: number`
   - Actions: `setSelectedSourceText()`, `clearSourceSelection()`

2. [MODIFY] [types/drag.ts](metamorphs-web/src/types/drag.ts)
   - Add: `dragType: "sourceText" | "word" | ...`
   - Add: `draggedData: { sourceLineIndex?, selectedText?, ... }`

3. [MODIFY] [components/notebook/NotebookDropZone.tsx](metamorphs-web/src/components/notebook/NotebookDropZone.tsx)
   - Handle drop type: `dragType === "sourceText"`
   - Insert dropped text into current editing cell
   - Trigger workshop state update

4. [MODIFY] [components/notebook/ComparisonView.tsx](metamorphs-web/src/components/notebook/ComparisonView.tsx)
   - Make source text column draggable
   - Emit drag events for drop zones

---

### MODIFICATION 6: Improve the Compare View

**Current**: Basic side-by-side comparison
**Target**: Add lens selection, analysis, annotations

**Files to Create**:
1. [NEW] `/src/components/workspace/compare/CompareAnalysis.tsx`
   - Show insight summary
   - Highlight key differences
   - Show translation decisions

**Files to Modify**:

1. [MODIFY] [components/workspace/compare/CompareSheet.tsx](metamorphs-web/src/components/workspace/compare/CompareSheet.tsx)
   - Add lens selector dropdown: "meaning", "form", "tone", "culture"
   - Add granularity selector: "line", "phrase", "char"
   - Add synchronized scrolling toggle
   - Add export to PDF / save notes buttons

2. [MODIFY] [app/api/compares/route.ts](metamorphs-web/src/app/api/compares/route.ts)
   - Enhance with AI analysis generation
   - Store lens/granularity choices
   - Return structured diff data

3. [MODIFY] [components/notebook/ComparisonView.tsx](metamorphs-web/src/components/notebook/ComparisonView.tsx)
   - Use lens/granularity settings
   - Show diffs based on selected lens
   - Add export functionality

4. [MODIFY] [types/workspace.ts:18-24](metamorphs-web/src/types/workspace.ts#L18-L24)
   - Update `CompareNode` type with selected lens/granularity
   - Add: `annotations: string[]`

---

### MODIFICATION 7: Make Translation Journey More Conversational

**Current**: Static reflection generation
**Target**: Interactive conversation with AI

**Files to Create**:
1. [NEW] `/src/components/notebook/JourneyChat.tsx`
   - Display reflection as conversation
   - Add "Ask a follow-up" input
   - Show typing animation

2. [NEW] `/src/lib/hooks/useJourneyConversation.ts`
   - Manage conversation history
   - Handle follow-up questions
   - Store in thread state

3. [NEW] `/src/app/api/journey/follow-up/route.ts`
   - Accept: `threadId`, `question`, `conversationHistory`
   - Call OpenAI with conversational system prompt
   - Return: follow-up response

**Files to Modify**:

1. [MODIFY] [app/api/journey/generate-reflection/route.ts](metamorphs-web/src/app/api/journey/generate-reflection/route.ts)
   - Add conversational system prompt
   - Generate opening reflection for conversation
   - Add follow-up question generation

2. [MODIFY] [store/notebookSlice.ts](metamorphs-web/src/store/notebookSlice.ts)
   - Add: `journeyConversation: Message[]`
   - Add: `addJourneyMessage(message)` action
   - Store conversation in local state

3. [MODIFY] [components/notebook/JourneySummary.tsx](metamorphs-web/src/components/notebook/JourneySummary.tsx)
   - Replace static text with JourneyChat component
   - Load/save conversation from thread state
   - Add input for follow-ups

4. [MODIFY] [docs/context/DATABASE_SCHEMA.md](metamorphs-web/docs/context/DATABASE_SCHEMA.md)
   - Add: `journey_conversation: Message[]` to `chat_threads.state`

---

## IMPLEMENTATION PRIORITY & DEPENDENCIES

### Phase 1: Foundation (Low Risk, High Impact)
1. **Remove Word Labels** (MODIFICATION 3)
   - Simplest change, no dependencies
   - Pure UI removal

2. **Add Language Selector** (MODIFICATION 1)
   - Independent feature
   - No impact on existing functionality

3. **Update Intent to Two Fields** (MODIFICATION 2)
   - Builds on existing guide state
   - Update prompts to use both fields

### Phase 2: Interactivity (Medium Risk)
4. **Make Intent Updatable** (MODIFICATION 4)
   - Depends on intent fields being split (Phase 1)
   - Uses existing update mechanisms

5. **Source Text Dragging** (MODIFICATION 5)
   - New drag type, extends dnd-kit usage
   - Adds to drop zone logic

### Phase 3: Advanced Features (Higher Risk)
6. **Improve Compare View** (MODIFICATION 6)
   - Enhances comparison experience
   - May need database schema updates

7. **Conversational Journey** (MODIFICATION 7)
   - Most complex, requires new API endpoint
   - Extends AI interaction patterns

---

## CRITICAL CODE REFERENCES SUMMARY

| Purpose | File Path | Lines | Key Code |
|---------|-----------|-------|----------|
| Workshop options generation | [api/workshop/generate-options/route.ts](metamorphs-web/src/app/api/workshop/generate-options/route.ts) | 1-267 | Main LLM call, response parsing |
| Workshop state management | [store/workshopSlice.ts](metamorphs-web/src/store/workshopSlice.ts) | 78-184 | Zustand store with persist |
| Notebook state management | [store/notebookSlice.ts](metamorphs-web/src/store/notebookSlice.ts) | 132-464 | Cell state, draft translations |
| Guide/interview state | [store/guideSlice.ts](metamorphs-web/src/store/guideSlice.ts) | 1-200 | Translation intent, guide answers |
| Guide UI entry point | [components/guide/GuideRail.tsx](metamorphs-web/src/components/guide/GuideRail.tsx) | 1-600+ | User input for guide answers |
| Prompt building | [lib/ai/workshopPrompts.ts](metamorphs-web/src/lib/ai/workshopPrompts.ts) | 1-300+ | System + user prompts |
| Cell display | [components/notebook/CellBody.tsx](metamorphs-web/src/components/notebook/CellBody.tsx) | 1-100+ | Source + translation rendering |
| Assembly view | [components/notebook/PoemAssembly.tsx](metamorphs-web/src/components/notebook/PoemAssembly.tsx) | 1-600+ | Final poem display, export |
| Comparison view | [components/notebook/ComparisonView.tsx](metamorphs-web/src/components/notebook/ComparisonView.tsx) | 1-500+ | Split-screen comparison |
| Type definitions | [types/notebook.ts](metamorphs-web/src/types/notebook.ts) | 1-50+ | NotebookCell, cell types |
| Type definitions | [types/workshop.ts](metamorphs-web/src/types/workshop.ts) | 1-50+ | Workshop state types |
| Database schema | [docs/context/DATABASE_SCHEMA.md](metamorphs-web/docs/context/DATABASE_SCHEMA.md) | All | chat_threads state structure |
| Model configuration | [lib/models.ts](metamorphs-web/src/lib/models.ts) | 1-20 | LLM model names, defaults |
| Feature flags | [lib/featureFlags.ts](metamorphs-web/src/lib/featureFlags.ts) | 1-20 | Feature flag evaluation |
| Environment variables | [.env.example](.env.example) | 1-30 | Configuration keys |

---

## KEY ARCHITECTURAL PATTERNS

### 1. State Management Hierarchy
```
Database (chat_threads.state)
  ↓ (fetched via Supabase)
Zustand Stores (workshopSlice, notebookSlice, guideSlice)
  ↓ (synced to)
LocalStorage via threadStorage
  ↓ (components read from)
React Components
```

### 2. Data Flow for Workshop
```
User selects line
  ↓
Call /api/workshop/generate-options
  ↓
Extract guide answers from thread state
  ↓
Build prompts + call OpenAI
  ↓
Parse + validate response
  ↓
Update workshop store + cache
  ↓
Render word options
  ↓
User selects word options
  ↓
Call /api/workshop/save-line
  ↓
Update database + local store
```

### 3. Component Organization
```
Feature Slices:
  - Each feature has own directory (workshop/, notebook/, guide/)
  - Self-contained: UI + hooks + types + store updates
  - Shared primitives in ui/
  - Utilities in lib/
```

---

## TESTING RECOMMENDATIONS

### Unit Tests Priority
1. Workshop prompt generation (lib/ai/workshopPrompts.ts)
2. Text parsing/tokenization (lib/workshop/syllables.ts)
3. State management (store/workshopSlice.ts, notebookSlice.ts)
4. Type definitions validation

### Integration Tests Priority
1. Workshop flow: generate → select → save → display
2. Guide answer persistence and retrieval
3. API endpoint response parsing
4. Draft auto-save mechanism

### E2E Tests Priority
1. Complete translation journey (upload → workshop → notebook → assembly)
2. Guide answer updates triggering re-generation
3. State persistence across page reload
4. Comparison view synchronization

---

## PERFORMANCE OPTIMIZATION OPPORTUNITIES

1. **Memoization**: Prevent unnecessary re-renders of large lists (PoemAssembly, ComparisonView)
2. **Code Splitting**: Lazy-load heavy components (ComparisonView, PoemAssembly)
3. **Request Debouncing**: Already done for auto-save (3s debounce), consider for guide answer updates
4. **Caching**: Workshop options already cached (1 hour TTL), consider caching guide answers too
5. **Image Optimization**: If adding poetry images, use next/image

---

## SECURITY CONSIDERATIONS

1. **API Rate Limiting**: Already implemented (10 req/min per thread)
2. **Authentication**: Supabase SSR middleware handles auth
3. **Input Validation**: Zod schemas validate all request data
4. **XSS Prevention**: React escapes by default, validate user-generated content
5. **Database**: Use parameterized queries (Supabase client handles this)

---

## DOCUMENTATION REFERENCES

See additional documentation in the project:
- [API_ROUTES.md](metamorphs-web/docs/context/API_ROUTES.md) - All endpoints
- [COMPONENTS_STRUCTURE.md](metamorphs-web/docs/context/COMPONENTS_STRUCTURE.md) - Component organization
- [STATE_MANAGEMENT.md](metamorphs-web/docs/context/STATE_MANAGEMENT.md) - Zustand patterns
- [LLM_INTEGRATION_GUIDE.md](metamorphs-web/docs/context/LLM_INTEGRATION_GUIDE.md) - OpenAI integration
- [TESTING_STRATEGIES.md](metamorphs-web/docs/context/TESTING_STRATEGIES.md) - Testing approaches

---

**Analysis Complete**
Generated: 2025-10-26
Analyzer: Claude Code Comprehensive Codebase Analysis Tool
