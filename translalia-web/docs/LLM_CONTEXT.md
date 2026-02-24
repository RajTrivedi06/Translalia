# Translalia — LLM Context Document

> **Status**: Deprecated as primary source. Use root docs first:
> - `docs/05-llm/DOC_MAP.md`
> - `docs/05-llm/context-packs/frontend-pack.md`
> - `docs/05-llm/context-packs/backend-pack.md`
> - `docs/05-llm/context-packs/db-pack.md`
>
> This file is retained as a legacy deep-reference document.

> **Purpose**: This document provides comprehensive context about the Translalia application for LLM-assisted development sessions. It captures the architecture, key features, state management patterns, and codebase structure.

---

## 1. Application Overview

### What is Translalia?

**Translalia** is a **decolonial, AI-assisted creative poetry translation workspace**. It enables users to translate poetry line-by-line with the help of AI, preserving nuance, cultural context, and artistic intent while giving translators full creative control.

### Core Philosophy

- **Human-in-the-loop**: AI provides suggestions; the human translator makes final decisions
- **Decolonial approach**: Respects source language varieties, dialects, and cultural contexts
- **Creative translation**: Goes beyond literal translation to preserve poetic qualities
- **Prismatic translation**: Offers multiple translation variants with different artistic approaches via archetypes

### Key User Flow

```
1. Guide Rail Setup
   └── User pastes source poem
   └── User provides translation intent/instructions
   └── User specifies target language/variety (Translation Zone)
   └── User selects viewpoint range mode (focused/balanced/adventurous)
   └── User selects translation method (Method 2 is default)

2. Workshop (Translation)
   └── Work on poem line-by-line or stanza-by-stanza
   └── AI generates 3 archetype-based variants per line (A/B/C)
   └── User selects preferred variant or edits manually
   └── Words show alignment with original text

3. Notebook (Assembly)
   └── View all completed/draft translations
   └── Edit final translations
   └── Export completed poem

4. Diary (Archive)
   └── View all completed poems
   └── See original text, translations, notes, and journey summaries
   └── Browse translation history
```

---

## 2. Technology Stack

### Framework & Runtime

| Technology   | Version | Purpose                     |
| ------------ | ------- | --------------------------- |
| Next.js      | 15.4.8  | App Router, API Routes, SSR |
| React        | 19.1.0  | UI Components               |
| TypeScript   | ^5      | Type safety                 |
| Tailwind CSS | ^3.4.17 | Styling                     |

### State Management

| Library         | Purpose                                                   |
| --------------- | --------------------------------------------------------- |
| Zustand         | Client-side global/UI state (persisted per-thread)        |
| TanStack Query  | Server state, data fetching, caching                      |
| `threadStorage` | Custom localStorage wrapper for thread-scoped persistence |

### Backend Services

| Service       | Purpose                                           |
| ------------- | ------------------------------------------------- |
| Supabase      | Authentication, PostgreSQL database, file storage |
| OpenAI        | LLM for translation, analysis, suggestions        |
| Upstash Redis | Rate limiting, distributed locks for recipes      |

### Key Dependencies

```json
{
  "@supabase/supabase-js": "2.55.0",
  "@supabase/ssr": "^0.5.0",
  "@tanstack/react-query": "^5.85.3",
  "openai": "^4.104.0",
  "zustand": "^5.0.7",
  "zod": "^3.25.76",
  "next-intl": "^4.5.5",
  "reactflow": "^11.11.4",
  "@dnd-kit/core": "^6.3.1"
}
```

---

## 3. Project Structure

```
translalia-web/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── [locale]/             # i18n locale routes
│   │   │   ├── (app)/            # Protected app routes
│   │   │   │   ├── workshop/     # Main translation workspace
│   │   │   │   ├── notebook/     # Translation assembly view
│   │   │   │   ├── diary/        # Completed poems archive
│   │   │   │   └── account/      # User account settings
│   │   │   └── auth/             # Sign-in/sign-up pages
│   │   ├── api/                  # API Route Handlers
│   │   │   ├── auth/             # Auth sync routes
│   │   │   ├── diary/            # Completed poems archive
│   │   │   ├── journey/          # Reflection/feedback generation
│   │   │   ├── notebook/         # AI assist, prismatic, suggestions
│   │   │   ├── verification/     # Translation grading/analytics
│   │   │   └── workshop/         # Translation APIs
│   │   └── globals.css           # Global styles
│   │
│   ├── components/               # React Components
│   │   ├── guide/                # Guide Rail components
│   │   ├── notebook/             # Notebook panel components
│   │   ├── workshop/             # Workshop components
│   │   ├── workshop-rail/        # Workshop sidebar/rail
│   │   ├── ui/                   # Shared UI primitives
│   │   ├── auth/                 # Auth components
│   │   └── providers.tsx         # React Query + Supabase providers
│   │
│   ├── store/                    # Zustand Stores
│   │   ├── guideSlice.ts         # Guide Rail state (poem, intent, settings)
│   │   ├── workshopSlice.ts      # Workshop state (translations, drafts)
│   │   ├── notebookSlice.ts      # Notebook state (UI preferences)
│   │   └── workspace.ts          # Global workspace state
│   │
│   ├── hooks/                    # React Hooks
│   │   ├── useJourney.ts         # Journey/reflection data
│   │   ├── useProfile.ts         # User profile
│   │   ├── useSupabaseUser.ts    # Auth user hook
│   │   └── useThreadId.ts        # Thread ID from URL
│   │
│   ├── lib/                      # Utilities & Helpers
│   │   ├── ai/                   # AI/LLM Integration
│   │   │   ├── openai.ts         # OpenAI client
│   │   │   ├── variantRecipes.ts # Recipe generation system (Method 2 core)
│   │   │   ├── workshopPrompts.ts # Prompt templates & builders
│   │   │   ├── translatorPersonality.ts # Personality profile builder
│   │   │   ├── diversityGate.ts  # Distinctness checking & regeneration
│   │   │   ├── alignmentGenerator.ts # Word-level alignment
│   │   │   ├── stopwords.ts      # Multilingual stopwords
│   │   │   ├── cache.ts          # In-memory LLM response cache
│   │   │   └── ratelimit.ts      # Rate limiting
│   │   ├── threadStorage.ts      # Thread-scoped localStorage
│   │   ├── supabaseServer.ts     # Server-side Supabase client
│   │   ├── supabaseBrowser.ts    # Browser Supabase client
│   │   ├── apiGuard.ts           # API auth guard
│   │   └── featureFlags.ts       # Feature flag helpers
│   │
│   ├── server/                   # Server-only modules
│   │   ├── guide/                # Guide analysis logic
│   │   └── audit/                # Audit logging
│   │
│   ├── types/                    # TypeScript Types
│   │   ├── lineTranslation.ts    # Translation variant types
│   │   ├── workshop.ts           # Workshop types
│   │   └── notebook.ts           # Notebook types
│   │
│   └── i18n/                     # Internationalization
│       ├── request.ts            # i18n request handler
│       └── routing.ts            # Locale routing
│
├── messages/                     # i18n translation files
│   ├── en.json
│   ├── es.json
│   ├── ar.json
│   ├── hi.json
│   ├── ml.json (Malayalam)
│   ├── ta.json (Tamil)
│   ├── te.json (Telugu)
│   └── zh.json (Chinese)
│
├── middleware.ts                 # Auth middleware
└── next.config.ts                # Next.js configuration
```

---

## 4. Database Schema (Supabase/PostgreSQL)

### Core Tables

```
┌─────────────────────────────────────────────────────────────┐
│  profiles                                                    │
├─────────────────────────────────────────────────────────────┤
│  id (uuid, PK)                                              │
│  display_name (text)                                        │
│  username (text, unique)                                    │
│  email (text)                                               │
│  avatar_url (text)                                          │
│  locale (text)                                              │
│  created_at (timestamptz)                                   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  projects                                                    │
├─────────────────────────────────────────────────────────────┤
│  id (uuid, PK)                                              │
│  title (text, <=120)                                        │
│  owner_id (uuid, FK → profiles.id)                          │
│  src_lang (text, nullable)                                  │
│  tgt_langs (text[], nullable)                               │
│  created_at (timestamptz)                                   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  chat_threads                                                │
├─────────────────────────────────────────────────────────────┤
│  id (uuid, PK)                                              │
│  project_id (uuid, FK → projects.id)                        │
│  title (text, <=120)                                        │
│  created_by (uuid, FK → profiles.id)                        │
│  raw_poem (text)                                            │
│  state (jsonb, default {}) - server-owned session state     │
│    ├── guide_answers (GuideAnswers)                         │
│    ├── poem_analysis ({ language?: string })                │
│    ├── variant_recipes_v2 (VariantRecipesBundle)           │
│    ├── workshop_lines (WorkshopLineWithVerification[])     │
│    └── notebook_notes ({ thread_note?, line_notes? })       │
│  created_at (timestamptz)                                   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  chat_messages                                               │
├─────────────────────────────────────────────────────────────┤
│  id (uuid, PK)                                              │
│  project_id (uuid, FK → projects.id)                        │
│  thread_id (uuid, FK → chat_threads.id)                     │
│  role (enum: 'user' | 'assistant' | 'system')               │
│  content (text)                                             │
│  meta (jsonb)                                               │
│  created_by (uuid)                                          │
│  created_at (timestamptz)                                   │
└─────────────────────────────────────────────────────────────┘
```

### Additional Tables

- **journey_items**: Activity timeline entries (reflections, comparisons)
- **journey_ai_summaries**: AI-generated journey summaries per thread
  - `id` (uuid, PK)
  - `thread_id` (uuid, FK → chat_threads.id)
  - `reflection_text` (text) - Main narrative reflection
  - `insights` (text[]) - Array of insights
  - `strengths` (text[]) - Array of identified strengths
  - `challenges` (text[]) - Array of identified challenges
  - `recommendations` (text[]) - Array of recommendations
  - `created_at` (timestamptz)
- **uploads**: File uploads per user/thread
- **compares**: Version comparison records

---

## 5. State Management Architecture

### Thread-Scoped State Pattern

All user state is **scoped by thread ID** to prevent cross-thread data leakage:

```typescript
// threadStorage.ts - Custom localStorage wrapper
export const threadStorage = {
  getItem: (name: string): string | null => {
    const tid = getActiveThreadId();
    const key = tid ? `${name}:${tid}` : `${name}:__global__`;
    return window.localStorage.getItem(key);
  },
  // ... setItem, removeItem follow same pattern
};
```

### Zustand Stores

#### 1. `guideSlice.ts` — Guide Rail State

```typescript
interface GuideState {
  // Thread isolation
  hydrated: boolean;
  meta: { threadId: string | null };

  // Poem data
  poem: {
    text: string;
    isSubmitted: boolean;
    preserveFormatting: boolean;
    stanzas: SimplePoemStanzas | null;
    customSegmentation: {
      lineToSegment: Record<number, number>;
      totalSegments: number;
    } | null;
  };

  // Translation settings
  translationIntent: { text: string | null; isSubmitted: boolean };
  translationZone: { text: string; isSubmitted: boolean };
  sourceLanguageVariety: { text: string | null; isSubmitted: boolean };

  // Viewpoint & Model settings
  viewpointRangeMode: "focused" | "balanced" | "adventurous";
  translationModel:
    | "gpt-4o"
    | "gpt-4o-mini"
    | "gpt-4-turbo"
    | "gpt-5"
    | "gpt-5-mini";
  translationMethod: "method-1" | "method-2"; // Method 2 is default

  // UI state
  isCollapsed: boolean;
  width: number;
  isWorkshopUnlocked: boolean;
}
```

#### GuideAnswers Interface

```typescript
interface GuideAnswers {
  translationIntent?: string | null;
  sourceLanguageVariety?: string | null;
  viewpointRangeMode?: "focused" | "balanced" | "adventurous";
  translationModel?:
    | "gpt-4o"
    | "gpt-4o-mini"
    | "gpt-4-turbo"
    | "gpt-5"
    | "gpt-5-mini";
  translationMethod?: "method-1" | "method-2";

  // Legacy structured fields (optional, for backward compatibility)
  targetLanguage?: { lang: string; variety: string; script: string };
  audience?: { audience: string; goal: string[] };
  stance?: { closeness: "close" | "in_between" | "natural" };
  style?: { vibes: string[] };
  policy?: { must_keep: string[]; no_go: string[] };
  form?: { line_breaks: string; rhyme: string; line_length: string };
  style_anchors?: string[];
  translationZone?: string | null;
}
```

#### 2. `workshopSlice.ts` — Workshop/Translation State

```typescript
interface WorkshopState {
  // Thread isolation
  hydrated: boolean;
  meta: { threadId: string | null };

  // Current line being worked on
  currentLineIndex: number | null;

  // Line-level translations (lineIndex -> LineTranslationResponse)
  lineTranslations: Record<number, LineTranslationResponse | null>;

  // Selected variant for each line (lineIndex -> variant 1|2|3)
  selectedVariant: Record<number, 1 | 2 | 3 | null>;

  // Poem lines from Guide Rail
  poemLines: string[];

  // Completed translations (lineIndex -> final text)
  completedLines: Record<number, string>;

  // Draft translations (lineIndex -> work-in-progress text)
  draftLines: Record<number, string>;
}
```

#### 3. `notebookSlice.ts` — Notebook UI State

```typescript
interface NotebookState {
  hydrated: boolean;
  meta: { threadId: string | null };
  lastEditedLine: number | null;
  showLineNumbers: boolean;
  fontSize: "small" | "medium" | "large";
  undoStack: UndoEntry[];
}
```

### Thread Switch Detection

All stores implement thread switch detection in their `merge` function:

```typescript
merge: (persisted, current) => {
  const tid = getActiveThreadId();

  // If thread IDs don't match, return fresh state
  if (tid && p.meta?.threadId && p.meta.threadId !== tid) {
    console.log(`Thread switch detected: ${p.meta.threadId} → ${tid}`);
    return { ...current, hydrated: true, meta: { threadId: tid } };
  }

  // Otherwise restore persisted state
  return { ...current, ...p, hydrated: true, meta: { threadId: tid } };
};
```

---

## 6. API Routes

### Workshop APIs (`/api/workshop/`)

| Endpoint                       | Method | Purpose                                            |
| ------------------------------ | ------ | -------------------------------------------------- |
| `/translate-line`              | POST   | Method 1: Generate 3 literalness-spectrum variants |
| `/translate-line-with-recipes` | POST   | **Method 2**: Recipe-driven prismatic translation  |
| `/initialize-translations`     | POST   | Batch initialize translations for all lines        |
| `/save-line`                   | POST   | Save completed translation for a line              |
| `/save-manual-line`            | POST   | Save manually edited translation                   |
| `/additional-suggestions`      | POST   | Get more word suggestions for a line               |
| `/translation-status`          | GET    | Get status of all line translations                |
| `/retry-stanza`                | POST   | Retry failed stanza translation                    |
| `/requeue-stanza`              | POST   | Requeue stanza for processing                      |

### Notebook APIs (`/api/notebook/`)

| Endpoint            | Method | Purpose                       |
| ------------------- | ------ | ----------------------------- |
| `/prismatic`        | POST   | Generate prismatic variants   |
| `/ai-assist`        | POST   | Get AI assistance for editing |
| `/poem-suggestions` | POST   | Get full poem suggestions     |

### Journey APIs (`/api/journey/`)

| Endpoint                   | Method | Purpose                               |
| -------------------------- | ------ | ------------------------------------- |
| `/list`                    | GET    | List journey items for project        |
| `/generate-reflection`     | POST   | Generate AI reflection on translation |
| `/save-reflection`         | POST   | Save reflection to database           |
| `/generate-brief-feedback` | POST   | Quick feedback on translation         |

### Verification APIs (`/api/verification/`)

| Endpoint           | Method | Purpose                   |
| ------------------ | ------ | ------------------------- |
| `/grade-line`      | POST   | Grade translation quality |
| `/grade/[auditId]` | GET    | Get grading result        |
| `/analytics`       | GET    | Translation analytics     |
| `/context-notes`   | POST   | Add context notes         |
| `/feedback`        | POST   | Submit feedback           |

### Diary APIs (`/api/diary/`)

| Endpoint           | Method | Purpose                               |
| ------------------ | ------ | ------------------------------------- |
| `/completed-poems` | GET    | Get paginated list of completed poems |

**Details:**

- **Authentication**: Required (uses `requireUser` from `@/lib/apiGuard`)
- **Query Parameters**:
  - `limit` (optional, default 20): Number of results (1-50)
  - `beforeCreatedAt` (optional): ISO datetime string for cursor pagination
  - `beforeId` (optional): UUID string for cursor pagination
- **Response Structure**:
  ```typescript
  {
    ok: true,
    items: DiaryEntry[],
    nextCursor?: {
      beforeCreatedAt: string;
      beforeId: string;
    }
  }
  ```
- **RPC Function**: Uses `diary_completed_poems` PostgreSQL function
- **Pagination**: Cursor-based pagination using `(created_at, id)` tuple
- **Completion Criteria**: A poem is considered completed when:
  - `workshop_lines` exists in `chat_threads.state` and is a JSONB array
  - Array length > 0
  - No null elements in the array
  - Every element has a non-empty `translated` field

---

## 7. Translation System — Method 2 (Recipe-Driven Prismatic)

**Method 2** is the default and recommended translation approach. It uses a sophisticated **archetype-based recipe system** to generate diverse, artistically distinct translation variants.

### Core Concepts

| Concept   | Description                                                                                |
| --------- | ------------------------------------------------------------------------------------------ |
| Archetype | Fixed artistic identity for each variant (A, B, C)                                         |
| Lens      | Configuration for translation perspective (imagery, voice, sound, syntax, cultural)        |
| Recipe    | Reusable viewpoint definition combining archetype, lens, directive, and unusualness budget |
| Bundle    | Collection of 3 recipes cached per thread with metadata (mode, contextHash, createdAt)     |

### The Three Archetypes

Each variant has a **fixed archetype** that defines its artistic identity:

```
═══════════════════════════════════════════════════════════════
VARIANT A: ESSENCE CUT
═══════════════════════════════════════════════════════════════
• Distill core meaning + emotional contour
• Clean, legible, compressed — NOT literal word-by-word
• Preserve key imagery IF it helps clarity, but simplify structure
• Think: "What would a master say in fewer, sharper words?"

═══════════════════════════════════════════════════════════════
VARIANT B: PRISMATIC REIMAGINING
═══════════════════════════════════════════════════════════════
• Reimagine with fresh metaphor system
• MUST introduce at least 1 new central image/metaphor anchor
• Avoid reusing the source's main metaphor nouns directly
• Think: "What if a poet saw this moment through different eyes?"

═══════════════════════════════════════════════════════════════
VARIANT C: WORLD & VOICE TRANSPOSITION
═══════════════════════════════════════════════════════════════
• Shift narrator stance and/or world-frame
• MUST change stance (I→we, you→we, impersonal→direct) OR shift time/place/register
• Keep semantic anchors, but in a different voice/world
• Think: "Who else could be speaking this, from when/where?"
```

### Lens Configuration

Each recipe has a lens that controls 5 translation aspects:

```typescript
interface Lens {
  imagery: "preserve" | "adapt" | "substitute" | "transform";
  voice: "preserve" | "shift" | "collective" | "intimate";
  sound: "preserve" | "adapt" | "prioritize" | "ignore";
  syntax: "preserve" | "adapt" | "fragment" | "invert";
  cultural: "preserve" | "adapt" | "hybrid" | "localize";
}
```

### Viewpoint Range Modes

The mode scales how aggressive the variants can be:

| Mode        | Description                                    | Jaccard Threshold |
| ----------- | ---------------------------------------------- | ----------------- |
| Focused     | Conservative but not literal; subtle choices   | 0.70 (lenient)    |
| Balanced    | Clear artistic differentiation (default)       | 0.60 (moderate)   |
| Adventurous | Bold reframes; push archetypes to their limits | 0.50 (strict)     |

### Unusualness Budgets by Mode

| Mode        | Recipe A | Recipe B | Recipe C |
| ----------- | -------- | -------- | -------- |
| Focused     | low      | low      | medium   |
| Balanced    | low      | medium   | medium   |
| Adventurous | low      | medium   | high     |

### Recipe Generation & Caching

Recipes are generated once per thread (or when context changes) and cached:

```typescript
interface VariantRecipesBundle {
  threadId: string;
  mode: ViewpointRangeMode;
  contextHash: string; // SHA-256 hash of relevant context
  recipes: [VariantRecipe, VariantRecipe, VariantRecipe];
  createdAt: number;
  modelUsed: string;
}
```

**Context hash includes:**

- Schema version (for cache invalidation on schema changes)
- Translation intent & zone
- Stance closeness
- Style vibes
- Policy (must_keep, no_go)
- Source/target language pair
- Poem text hash

### Translator Personality

Built from user's guide answers, this defines the translator's identity:

```typescript
interface TranslatorPersonality {
  domain: string; // From translationZone
  purpose: string; // From translationIntent
  literalness: number; // 0-100
  register: string[]; // From style.vibes
  sacred_terms: string[]; // From policy.must_keep
  forbidden_terms: string[]; // From policy.no_go
  approach_summary: string;
  creativity_level: "conservative" | "moderate" | "bold";
  priority: "accuracy" | "naturalness" | "expressiveness";
  source_language_variety?: string;
  source_language_notes?: string;
}
```

---

## 8. Diversity Gate

The **Diversity Gate** ensures translation variants are observably different. It performs cheap post-generation checks and triggers single-variant regeneration if needed.

### Distinctness Checks (Mode-Scaled)

1. **Subject Opener Check** (balanced/adventurous): No two variants may share the same subject opener pattern (I, we, you, etc.)

2. **Opening Content Bigram Check**: No two variants may share the same first 2 non-stopword tokens

3. **Comparison Marker Check**:

   - Balanced/Adventurous: At most 1 variant may use comparison markers (like, as, comme, como)
   - Focused: Allow up to 2, but warn if all 3

4. **Walk-Verb Bucket Check** (balanced/adventurous): Multiple variants cannot use verbs from the walk-verb bucket (walk, stroll, march, etc.)

5. **Jaccard Similarity Check**: Token overlap must be below threshold for the mode

### Regeneration

If variants fail the distinctness check, the gate triggers **feature-contrastive regeneration**:

```typescript
interface DistinctnessResult {
  pass: boolean;
  worstIndex: number | null; // Index to regenerate
  reason?: string;
  details?: {
    jaccardScores: number[];
    maxOverlap: number;
    pairWithMaxOverlap: [number, number];
  };
}
```

The regeneration prompt includes:

- Other variants to avoid copying
- Contrastive constraints (MUST DO / DO NOT USE lists)
- The recipe directive to follow
- Higher temperature (0.9) for diversity

---

## 9. Word-Level Alignment

Method 2 generates word-level alignments to maintain compatibility with the Workshop's drag-and-drop UX:

```typescript
interface AlignedWord {
  original: string; // Source word/phrase
  translation: string; // Translated word/phrase
  partOfSpeech: string; // Grammar tag
  position: number; // Position in line (0-indexed)
}
```

Alignments are generated in parallel for all 3 variants using `gpt-4o-mini` with temperature 0 for consistency.

---

## 10. Translation Response Structure

Both methods return the same structure for Workshop compatibility:

```typescript
interface LineTranslationResponse {
  lineOriginal: string;
  translations: [
    LineTranslationVariant,
    LineTranslationVariant,
    LineTranslationVariant
  ];
  modelUsed: string;
}

interface LineTranslationVariant {
  variant: 1 | 2 | 3;
  fullText: string;
  words: AlignedWord[];
  metadata: {
    literalness: number; // 0-1 scale
    characterCount: number;
    preservesRhyme?: boolean;
    preservesMeter?: boolean;
  };
}
```

**Method 2 Literalness Mapping:**

- Variant 1 (Recipe A / Essence Cut): 0.8 (hardcoded placeholder)
- Variant 2 (Recipe B / Prismatic Reimagining): 0.5 (hardcoded placeholder)
- Variant 3 (Recipe C / World Voice Transposition): 0.2 (hardcoded placeholder)

**⚠️ Note**: These are hardcoded placeholder values, not computed literalness scores. The UI does not display literalness (it's commented out in WordGrid.tsx line 818-820). The values are included for API compatibility with Method 1's response structure but have no semantic meaning in Method 2.

### 7.4.1 Unusualness Budget Enforcement

**⚠️ Important**: The unusualness budget is **not** translated into specific lexical constraints (e.g., "use words outside top 5000 common words"). Instead, it's a **descriptive label** that influences lens selection.

**How It Works**:

1. Mode determines unusualness budgets per variant (low/medium/high)
2. Mode determines which lens values are allowed (more restrictive for low, more permissive for high)
3. The budget is mentioned as a label in the prompt
4. Mode intensity guidance provides descriptive nudges

**Conclusion**: The unusualness budget is a descriptive label, not a lexical constraint. Enforcement comes through mode-driven lens constraints (more aggressive choices for higher budgets).

### 7.4.2 Context Hash Stability

**Issue**: The context hash includes legacy fields (`vibes`, `mustKeep`, `noGo`) that are never populated by the current UI, but could be populated via old flows, manual DB edits, or direct API calls.

**Impact**: If these fields are populated, the context hash changes, causing recipe cache invalidation. Since they're always empty in normal flows, the hash is stable for new threads.

**Potential Fix**: Remove legacy fields from context hash, or document that they're legacy and should not be used.

---

## 7.5 Method 1 vs Method 2: Codepath Comparison

### Are They Completely Separate?

**Yes**. Method 1 and Method 2 are **completely separate codepaths** with minimal shared components.

### Method 1 Codepath

**Endpoint**: `/api/workshop/translate-line`

**Components**:

- Uses `translateLineInternal()` → `buildLineTranslationPrompt()` (NOT recipe-aware)
- Does NOT use recipes, diversity gate, or recipe-aware prompts
- LLM returns 3 variants with word-level alignments directly
- Returns `LineTranslationResponse`

**Shared**: Only `buildTranslatorPersonality()` (logged, not in prompts) and response structure.

### Method 2 Codepath

**Endpoint**: `/api/workshop/translate-line-with-recipes`

**Components**:

- Uses `getOrCreateVariantRecipes()` - Recipe generation/caching
- Uses `buildRecipeAwarePrismaticPrompt()` - Recipe-aware prompts
- Uses `checkDistinctness()` - Diversity gate
- Uses `regenerateVariant()` - Single-variant regeneration
- Uses `generateAlignmentsParallel()` - Post-translation alignment
- Returns `LineTranslationResponse`

**Conclusion**: Method 1 uses literalness-spectrum approach. Method 2 uses recipe-driven approach with diversity gate and alignment generation. They are **completely separate codepaths**.

---

## 7.6 Recipe-Driven Endpoints Comparison

### Two Recipe-Driven Endpoints

Both `/api/workshop/translate-line-with-recipes` and `/api/notebook/prismatic` use the recipe-driven pipeline, but serve different UIs.

### `/api/workshop/translate-line-with-recipes` (Workshop UI)

**Purpose**: Line-by-line translation with drag-and-drop UX

**Features**:

- ✅ Word-level alignment generation (post-translation)
- ✅ Stanza context (prevLine, nextLine, stanzaIndex)
- ✅ Audit logging
- ✅ Returns `LineTranslationResponse` (with alignments)
- ⚠️ **Field mismatch**: Expects `"translation"` field but prompt shows `"text"` (see Known Issues)

### `/api/notebook/prismatic` (Notebook UI)

**Purpose**: Cell-based translation with refinement

**Features**:

- ❌ No word-level alignment (returns raw variants)
- ❌ No stanza context
- ✅ Current translation context (for refinement)
- ✅ Returns `{ variants, meta }` (raw variants)
- ✅ **Consistent with prompt**: Expects `"text"` field (matches prompt output format)

**Shared Components**: Both use `getOrCreateVariantRecipes()`, `buildRecipeAwarePrismaticPrompt()`, `checkDistinctness()`, `regenerateVariant()`, and `buildTranslatorPersonality()`.

**When Called**:

- Workshop endpoint: Called from Workshop UI when user translates a line
- Notebook endpoint: Called from Notebook UI when user generates variants for a cell

### 7.6.1 Known Issue: Translation Response Field Mismatch ⚠️ **NEEDS IMMEDIATE CODE FIX**

**Issue**: The translation prompt instructs LLM to return `"text"` field, but the workshop endpoint parsing code expects `"translation"` field. The notebook endpoint is consistent with the prompt.

**Impact**: If LLM follows the prompt exactly and returns `"text"`, the workshop endpoint will get empty strings (falls back to `""`). Notebook endpoint works correctly. In practice, LLMs are usually flexible and may return either field, but this is still a potential bug.

**⚠️ CRITICAL**: This mismatch can cause empty translations if the LLM follows the prompt exactly. **This requires an immediate code fix** to prevent potential production issues.

**Recommendation**: Update workshop endpoint parsing to check both `v.translation` and `v.text` (preferring `translation` for backward compatibility).

---

## 11. Internationalization (i18n)

The app uses `next-intl` for internationalization.

### Supported Locales

- English (en)
- Spanish (es, es-AR)
- Arabic (ar)
- Hindi (hi)
- Malayalam (ml)
- Tamil (ta)
- Telugu (te)
- Chinese (zh)

### Message Files Location

```
translalia-web/messages/
├── en.json      # English (base)
├── es.json      # Spanish
├── ar.json      # Arabic (RTL support)
├── hi.json      # Hindi
├── ml.json      # Malayalam
├── ta.json      # Tamil
├── te.json      # Telugu
└── zh.json      # Chinese
```

### Usage Pattern

```tsx
import { useTranslations } from "next-intl";

function Component() {
  const t = useTranslations("Workshop");
  return <h1>{t("title")}</h1>;
}
```

---

## 12. Stopwords System

The diversity gate uses language-specific stopwords for Jaccard calculations:

```typescript
// Supported languages
EN_STOPWORDS; // English
FR_STOPWORDS; // French
ES_STOPWORDS; // Spanish
DE_STOPWORDS; // German
PT_STOPWORDS; // Portuguese
IT_STOPWORDS; // Italian

// Language detection and selection
function pickStopwords(targetLanguage?: string): Set<string>;
function getStopwordsLanguage(stopwords: Set<string>): string;
```

---

## 13. Feature Flags

Feature flags are controlled via environment variables:

| Flag                                | Purpose                       |
| ----------------------------------- | ----------------------------- |
| `NEXT_PUBLIC_FEATURE_TRANSLATOR`    | Enable translator UI/endpoint |
| `NEXT_PUBLIC_FEATURE_VERIFY`        | Enable verification features  |
| `NEXT_PUBLIC_FEATURE_BACKTRANSLATE` | Enable back-translation       |
| `NEXT_PUBLIC_FEATURE_PRISMATIC`     | Enable prismatic variants     |
| `NEXT_PUBLIC_FEATURE_ROUTER`        | Enable intent routing         |
| `NEXT_PUBLIC_FEATURE_ENHANCER`      | Enable enhancer pathway       |

---

## 14. Environment Variables

### Required

```env
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
OPENAI_API_KEY=<openai-api-key>
```

### Optional

```env
TRANSLATOR_MODEL=gpt-4o           # Default translation model
ENHANCER_MODEL=gpt-5-mini         # Enhancer model
EMBEDDINGS_MODEL=text-embedding-3-large
UPSTASH_REDIS_REST_URL=<redis-url>
UPSTASH_REDIS_REST_TOKEN=<redis-token>
```

### Debug Flags

```env
DEBUG_VARIANTS=1    # Log recipe generation details
DEBUG_GATE=1        # Log diversity gate checks
```

---

## 15. Key Patterns & Conventions

### 1. API Route Pattern

```typescript
// All API routes follow this pattern
export async function POST(req: Request) {
  // 1. Auth guard
  const { user, response } = await requireUser();
  if (!user) return response;

  // 2. Input validation with Zod
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // 3. Rate limiting
  const rateCheck = await checkDailyLimit(user.id, `action:${threadId}`, limit);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // 4. Business logic
  // ...

  // 5. Return response
  return NextResponse.json({ ok: true, data });
}
```

### 2. GPT-5 Model Handling

GPT-5 models don't support custom temperature (only default 1 is allowed):

```typescript
const isGpt5 = model.startsWith("gpt-5");

const completion = isGpt5
  ? await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [...],
    })
  : await openai.chat.completions.create({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [...],
    });
```

### 3. Component State Hydration

```tsx
// Components wait for store hydration before rendering
function WorkshopPanel() {
  const hydrated = useGuideStore((s) => s.hydrated);

  if (!hydrated) {
    return <LoadingSpinner />;
  }

  return <ActualContent />;
}
```

### 4. Thread ID Synchronization

```tsx
// Components sync thread ID on mount
useEffect(() => {
  if (threadId) {
    setActiveThreadId(threadId);
    guideStore.setThreadId(threadId);
    workshopStore.setThreadId(threadId);
  }
}, [threadId]);
```

### 5. Recipe Lock Pattern

Recipes use distributed locks to prevent concurrent generation:

```typescript
const lockKey = `recipe-gen:${threadId}:${mode}:${contextHash}`;
const acquired = await lockHelper.acquire(lockKey, LOCK_TTL_SECONDS);

if (acquired) {
  try {
    // Generate recipes
  } finally {
    await lockHelper.release(lockKey);
  }
} else {
  // Wait and retry (exponential backoff)
}
```

---

## 16. Development Commands

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Check i18n messages
pnpm lint:i18n

# Build for production
pnpm build

# Start production server
pnpm start
```

---

## 17. Common Issues & Solutions

### Thread State Leakage

**Problem**: State from one thread appearing in another.
**Solution**: All stores use `threadStorage` with thread switch detection in `merge()`.

### Hydration Mismatch

**Problem**: SSR/client hydration differences.
**Solution**: Wait for `hydrated: true` in store before rendering dynamic content.

### Recipe Generation Contention

**Problem**: Multiple parallel requests trying to generate recipes.
**Solution**: Distributed lock with exponential backoff + jitter. Returns 503 with `retryable: true` if contention persists.

### Variant Similarity

**Problem**: Variants too similar to each other.
**Solution**: Diversity gate with mode-scaled Jaccard thresholds + structural checks + single-variant regeneration.

### LLM Rate Limiting

**Problem**: Too many API calls.
**Solution**: In-memory cache with 1-hour TTL; token bucket rate limiting via Redis.

---

## 18. Architecture Decisions (ADRs)

| ADR     | Decision                                                  |
| ------- | --------------------------------------------------------- |
| ADR-010 | Monolith (Next.js App) over Microservices                 |
| ADR-011 | JSON-first LLM outputs, no streaming (MVP)                |
| ADR-012 | Thread-scoped client state via `threadStorage`            |
| ADR-013 | Redis quotas deferred (stub helper ready)                 |
| ADR-014 | Consolidate flows around notebook/workshop/journey routes |
| ADR-015 | Method 2 (Recipe-Driven) as default translation method    |
| ADR-016 | Fixed archetypes per variant (v2 schema)                  |

---

## 19. Quick Reference

### Key Files to Understand

| File                                                        | Purpose                                  |
| ----------------------------------------------------------- | ---------------------------------------- |
| `src/store/guideSlice.ts`                                   | Guide Rail state (poem, settings)        |
| `src/store/workshopSlice.ts`                                | Translation state (variants, drafts)     |
| `src/lib/threadStorage.ts`                                  | Thread-scoped localStorage               |
| `src/lib/ai/variantRecipes.ts`                              | **Recipe system core (Method 2)**        |
| `src/lib/ai/workshopPrompts.ts`                             | Prompt builders including recipe-aware   |
| `src/lib/ai/diversityGate.ts`                               | **Distinctness checking & regeneration** |
| `src/lib/ai/translatorPersonality.ts`                       | Personality profile builder              |
| `src/lib/ai/alignmentGenerator.ts`                          | Word-level alignment generation          |
| `src/lib/ai/stopwords.ts`                                   | Multilingual stopword sets               |
| `src/app/api/workshop/translate-line-with-recipes/route.ts` | **Method 2 translation endpoint**        |
| `src/app/api/diary/completed-poems/route.ts`                | **Diary API endpoint**                   |
| `src/app/[locale]/(app)/diary/page.tsx`                     | **Diary page component**                 |
| `src/components/workshop-rail/`                             | Workshop UI components                   |
| `src/components/guide/`                                     | Guide Rail components                    |
| `supabase/migrations/20260121_diary_completed_poems.sql`    | **Diary RPC function migration**         |

### Key Types

| Type                      | Location                          | Purpose                           |
| ------------------------- | --------------------------------- | --------------------------------- |
| `LineTranslationResponse` | `types/lineTranslation.ts`        | Translation API response          |
| `GuideState`              | `store/guideSlice.ts`             | Guide Rail state shape            |
| `GuideAnswers`            | `store/guideSlice.ts`             | User's translation preferences    |
| `WorkshopState`           | `store/workshopSlice.ts`          | Workshop state shape              |
| `VariantRecipe`           | `lib/ai/variantRecipes.ts`        | Single recipe definition          |
| `VariantRecipesBundle`    | `lib/ai/variantRecipes.ts`        | Bundle of 3 recipes with metadata |
| `Archetype`               | `lib/ai/variantRecipes.ts`        | Variant artistic identity         |
| `Lens`                    | `lib/ai/variantRecipes.ts`        | Translation perspective config    |
| `TranslatorPersonality`   | `lib/ai/translatorPersonality.ts` | Built personality profile         |
| `DistinctnessResult`      | `lib/ai/diversityGate.ts`         | Gate check result                 |
| `AlignedWord`             | `lib/ai/alignmentGenerator.ts`    | Word-level alignment              |

---

## 20. Method 2 Translation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Request arrives at /api/workshop/translate-line-with-recipes │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Get or create variant recipes (cached per thread)        │
│    - Check memory cache → check DB cache → generate new     │
│    - Uses distributed lock to prevent concurrent generation │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Build translator personality from guide answers          │
│    - Domain, purpose, literalness, register, sacred terms   │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Build recipe-aware prismatic prompt                      │
│    - Archetype MUST rules + lens constraints                │
│    - Divergence rules (no shared openings, comparison limit)│
│    - Meaning anchors instruction                            │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Generate 3 variants via LLM                              │
│    - Uses user's selected model                             │
│    - JSON response format                                   │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Run diversity gate                                       │
│    - Mode-scaled Jaccard threshold                          │
│    - Subject opener + opening bigram + comparison checks    │
│    - Walk-verb bucket check                                 │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
            ┌───────────────┴───────────────┐
            ▼                               ▼
     ┌──────────┐                    ┌──────────────┐
     │ Pass     │                    │ Fail         │
     └────┬─────┘                    └──────┬───────┘
          │                                 │
          │                                 ▼
          │                    ┌─────────────────────────┐
          │                    │ Regenerate worst variant│
          │                    │ (feature-contrastive)   │
          │                    └───────────┬─────────────┘
          │                                │
          └────────────────┬───────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Generate word-level alignments (parallel for 3 variants) │
│    - Uses gpt-4o-mini with temperature 0                    │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Return LineTranslationResponse                           │
│    - 3 variants with fullText, words, metadata              │
│    - Compatible with Workshop drag-and-drop UX              │
└─────────────────────────────────────────────────────────────┘
```

---

## 21. Translation Performance (Parallel + Async)

This section explains how the app optimizes translation speed without sacrificing quality. The core idea is to keep the UI responsive while processing work in short, bounded, resumable ticks with safe parallelism.

### 21.1 Queue-Based Background Processing

- Translation jobs are enqueued into a Redis list and de-duped via an "active" set to prevent duplicates.
- A background worker consumes the queue, runs `runTranslationTick()` with a time budget, and re-enqueues if work remains.

**Key files**:

- `src/lib/workshop/translationQueue.ts`
- `scripts/translation-worker.ts`

### 21.2 Non-Blocking Tick Trigger (API)

- `/api/workshop/translation-status` can advance work but returns quickly (default 200ms).
- A tick runs with its own time budget; if it does not finish in time, it continues in the background and the next poll resumes.

**Key files**:

- `src/app/api/workshop/translation-status/route.ts`

### 21.3 Bounded Parallelism

There are two levels of bounded parallelism, both protected by a semaphore-style limiter:

1. **Stanza-level concurrency** (multiple stanzas per tick)

   - Controlled by env flags.
   - Limits concurrent stanza processing to avoid rate-limit spikes.

2. **Line-level concurrency** (multiple lines inside a stanza)
   - Also configurable and bounded.
   - Skips already-translated lines for fast resumptions.

**Key files**:

- `src/lib/workshop/runTranslationTick.ts`
- `src/lib/workshop/processStanza.ts`
- `src/lib/workshop/concurrencyLimiter.ts`

### 21.4 Time-Slicing (Budgeted Work)

- Each tick has a strict time budget (default 2.5s for API ticks, 15s for worker).
- The system checks remaining time before starting new work to ensure partial work does not finalize incorrectly.
- If the budget is exceeded, the tick pauses cleanly and resumes on the next poll or worker run.

**Key files**:

- `src/lib/workshop/runTranslationTick.ts`
- `src/lib/workshop/processStanza.ts`

### 21.5 Alignment Work Is Async and Low Priority

- Word alignment is queued separately with a low concurrency cap to avoid starving main translation.
- Alignments are generated in a single batched LLM call for all variants (reduces 3 calls to 1).

**Key files**:

- `src/lib/workshop/alignmentQueue.ts`
- `src/lib/ai/alignmentGenerator.ts`

### 21.6 Caching and Rate Limiting

- Redis cache (with dev memory fallback) reduces repeat LLM calls.
- Stanza processing is rate limited per user with exponential backoff.

**Key files**:

- `src/lib/ai/cache.ts`
- `src/lib/workshop/rateLimitedPool.ts`

### 21.7 Client Polling Strategy

- The UI polls translation status every 1.5s while a job is in progress.
- Responses are marked `no-store` to avoid stale state.

**Key files**:

- `src/lib/hooks/useTranslationJob.ts`

### 21.8 Relevant Environment Flags

```
ENABLE_PARALLEL_STANZAS=1
MAX_STANZAS_PER_TICK=1..5
CHUNK_CONCURRENCY=1..3
MAIN_GEN_PARALLEL_LINES=1
MAIN_GEN_LINE_CONCURRENCY=1..6
TICK_TIME_BUDGET_MS=2500
TRANSLATION_STATUS_TIMEOUT_MS=200
ENABLE_TICK_TIME_SLICING=1
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

---

## 22. Diary Feature

The **Diary** feature provides a personal archive of all completed translation work, allowing users to browse their translation history, view completed poems, and access associated notes and journey summaries.

### What is a "Completed Poem"?

A poem is considered "completed" when:

- `workshop_lines` exists in `chat_threads.state` and is a JSONB array
- Array length > 0
- No null elements in the array
- Every element has a non-empty `translated` field

This ensures that all lines of the poem have been translated and saved.

### Data Sources

The Diary feature aggregates data from multiple sources:

1. **`chat_threads.raw_poem`** (column)

   - **Type**: `text`
   - **Purpose**: Original source poem text
   - **Note**: This is a real column, not stored in `state->'raw_poem'`

2. **`chat_threads.state->'workshop_lines'`** (JSONB array)

   - **Type**: `jsonb`
   - **Structure**: Array of `WorkshopLineWithVerification` objects
   - **Purpose**: Completed line-by-line translations
   - **Format**: Each element contains `original`, `translated`, `completedAt`, etc.

3. **`chat_threads.state->'notebook_notes'`** (JSONB object)

   - **Type**: `jsonb`
   - **Structure**: `{ thread_note?: string | null, line_notes?: Record<number, string> }`
   - **Purpose**: User's notes about the translation
   - **Fields**:
     - `thread_note`: General reflection about the entire translation
     - `line_notes`: Object mapping line numbers to notes

4. **`journey_ai_summaries`** (table)
   - **Type**: Relational table
   - **Purpose**: AI-generated journey summaries
   - **Fields used**:
     - `reflection_text`: Main narrative reflection
     - `insights`: Array of insights
     - `strengths`: Array of identified strengths
     - `challenges`: Array of identified challenges
     - `recommendations`: Array of recommendations
   - **Note**: Only the **latest** summary per thread is returned (via LATERAL join)

### RPC Function: `diary_completed_poems`

**Location**: `supabase/migrations/20260121_diary_completed_poems.sql`

**Security**: `SECURITY INVOKER` (relies on `auth.uid()` for user filtering)

**Arguments**:

- `p_limit` (integer, default 20): Number of results to return (1-50)
- `p_before_created_at` (timestamptz, optional): Cursor for pagination
- `p_before_id` (uuid, optional): Cursor for pagination

**Return Shape**:

```typescript
{
  thread_id: uuid,
  title: text,
  thread_created_at: timestamptz,
  raw_poem: text,
  workshop_lines: jsonb,
  notebook_notes: jsonb,
  journey_summary_created_at: timestamptz | null,
  reflection_text: text | null,
  insights: text[] | null,
  strengths: text[] | null,
  challenges: text[] | null,
  recommendations: text[] | null
}[]
```

**Pagination Strategy**:

- Uses cursor-based pagination with `(created_at, id)` tuple
- DESC ordering: `order by ct.created_at desc, ct.id desc`
- Next page filter: `(created_at, id) < (p_before_created_at, p_before_id)`
- Limit: 1-50 (default 20)

**Performance Considerations**:

- Does NOT select the full `chat_threads.state` column (too large)
- Only extracts specific JSONB paths: `state->'workshop_lines'` and `state->'notebook_notes'`
- Uses indexes:
  - `journey_ai_summaries_thread_created_at_idx` for fast journey summary lookup
  - `chat_threads_created_by_created_at_idx` for fast user thread lookup

### UI Component

**Location**: `src/app/[locale]/(app)/diary/page.tsx`

**Features**:

- Fetches data using React Query
- Displays poem cards with:
  - Title and completion date
  - Original text (collapsible accordion)
  - Translation (line-by-line pairs, preserving formatting)
  - Notes section (thread note + line notes)
  - Journey summary (if present, with all arrays)
- Pagination: "Load more" button
- Empty state: Shows message with link to create workspace
- Loading and error states

**Rendering Guidelines**:

- Translations are displayed as line-by-line pairs (original → translated)
- Line breaks are preserved
- Long content (original text, journey summaries) uses collapsible accordions

### Navigation

The Diary link is added to the primary navigation in `src/components/auth/AuthNav.tsx`, accessible to all authenticated users.

### Internationalization

Translation keys are defined in `messages/en.json` under the `Diary` namespace:

- `title`, `heading`, `noCompletedPoems`
- `originalText`, `translatedText`
- `notes`, `threadNote`, `lineNotes`
- `journeySummary`, `insights`, `strengths`, `challenges`, `recommendations`
- `completedAt`, `loadMore`

---

_Last Updated: January 2026_
