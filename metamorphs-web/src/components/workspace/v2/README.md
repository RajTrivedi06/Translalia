# V2 Workspace (Phase 1 + Phase 2)

Complete implementation of the V2 workspace with Context Sidebar (Phase 1) and Creative Loop (Phase 2).

## Data Flow Diagram

```
LineSelectionView (Phase 1 source lines)
    ↓ [user selection]
useExplodeTokens (mock tokenization + lexicon)
    ↓ [token options by dialect]
WorkshopView (selections in Zustand store)
    ↓ [compile line]
NotebookView (assembled draft text)
```

## Phase 2: Creative Loop (Line Selection → Workshop → Notebook)

### Core Views

#### LineSelectionView
Multi-select interface for choosing lines to work on.
- **Features**: Multi-select with Cmd/Shift+Click, keyboard shortcuts (Cmd+A, Esc)
- **Navigation**: Proceed to Workshop with selected lines
- **State**: Stores line selections, sets currentLine for workshop phase
- **A11y**: Full keyboard navigation, screen reader announcements

#### WorkshopView
Token-based editing with dialect alternatives and phrase grouping.
- **Features**: Equal-weight dialect chips, custom "add your own" options, phrase merge/split
- **Data**: Mock tokenization with deterministic lexicon (Std, Scots, Creole, Casual)
- **Grouping**: Adjacent tokens → phrases, ungrouping with ephemeral state
- **Performance**: Windowing (150 tokens), memoized renders, narrow selectors
- **Autosave**: Local persistence per threadId with 2-second throttle

#### NotebookView
Compiled draft viewing with navigation controls.
- **Features**: Back to workshop, clear draft, copy to clipboard
- **Integration**: Receives compiled text from WorkshopView via appendNotebook
- **State**: Connected to workshopDraft.notebookText

### Workshop Types & Tokenization

#### Types (`/types/workshop.ts`)
```typescript
export type DialectTag = "Std" | "Scots" | "Creole" | "Casual" | string;
export type TokenOption = { id: string; label: string; dialect: DialectTag; from?: "llm" | "lex" | "user"; };
export type ExplodedToken = { tokenId: string; surface: string; kind: "word" | "phrase"; options: TokenOption[]; };
export type ExplodedLine = { lineId: string; lineIdx: number; tokens: ExplodedToken[]; };
```

#### useExplodeTokens Hook
Deterministic tokenization for development/demo.
- **Lexicon**: 50+ common words with dialect alternatives
- **Mock generation**: Fallback LLM-style options for unknown words
- **Helpers**: Line selection summaries, reconstruction from selections

### Persistence & Performance

#### Local Autosave (`_utils/persist.ts`)
- **Key pattern**: `mm:v2:${threadId}` for thread isolation
- **Data**: `{ tokenSelections, notebookText }` with JSON serialization
- **Restoration**: Auto-hydrate on thread change, clean slate for new threads
- **Throttling**: 2-second debounce to avoid excessive localStorage writes

#### Performance Optimizations
- **Narrow selectors**: Specific Zustand slices instead of whole ui object
- **Memoization**: Token arrays, visible tokens, stanza groupings
- **Windowing**: 150-token initial load with progressive "load more"
- **Ephemeral grouping**: Local component state to avoid server roundtrips

## Components

### ContextSidebar
Main container with responsive layout and dark mode support.
- **Props**: `{ projectId?: string; threadId?: string | null }`
- **Layout**: Fixed width (28%, 320px-420px), independent scroll
- **Cards**: SourceTextCard, AnalysisCard, SettingsCard

### SourceTextCard
Displays source text with stanza grouping, line numbers, search, and compact mode.
- **Features**: Numbered lines, stanza separation, search filter, compact toggle
- **Performance**: Windowing for >400 lines with "Load more" button
- **Data sources**: useInterviewFlow.peek + useNodes fallback

### AnalysisCard
Read-only snapshot of analysis metadata.
- **Fields**: Language, Form, Themes, Audience/Tone
- **Fallbacks**: Interview flow state → Node metadata → Placeholders

### SettingsCard
UI-only controls for target language, style, and dialect preferences.
- **State**: Zustand workspace store (`ui.targetLang`, `ui.targetStyle`, `ui.includeDialectOptions`)
- **Languages**: en, es, fr, de, hi, zh, ar
- **Styles**: literal, balanced, formal, dialect-rich

## Data Precedence

### Source Text
1. `flowPeek.state.source_text` or `flowPeek.state.poem_text`
2. `latestNode.overviewLines[]`
3. Empty state → "No source yet. Paste a poem or attach a file in Chat to get started."

### Analysis Snapshot
1. `flowPeek.state.analysis.{language,form,themes,audience|tone}`
2. `latestNode.meta.{language,form,themes,audience|tone}`
3. Placeholders → "Set during the interview once available."

## Utilities

### Data Helpers (`_utils/data.ts`)
- `getSourceLines({ flowPeek, nodes })` - Centralized source extraction with fallbacks
- `getAnalysisSnapshot({ flowPeek, nodeMeta })` - Analysis metadata with precedence
- `splitStanzas(text)` - Split text into stanza groups by double line breaks

### Internationalization (`_utils/i18n.ts`)
- `useT()` - Translation hook using `useUiLangStore`
- English-only for Phase 1, extensible for additional locales

### Performance (`_utils/useWindowedList.ts`)
- `useWindowedList(items, chunk)` - Virtual scrolling for large lists
- Auto-enabled when >400 lines, 200-item chunks
- Returns `{ visible, canLoadMore, loadMore, count, total }`

## Accessibility

- **Regions**: Each card has `role="region"` with `aria-labelledby`
- **Headings**: Semantic `<h2>` structure with unique IDs
- **Focus**: Visible focus rings on all interactive elements
- **Labels**: Proper `<label>` associations and `aria-label` attributes
- **Tab Order**: Logical: search → toggles/selects → content

## Known Limits

- **Line numbering**: Resets per stanza (Phase 1 limitation)
- **Windowing threshold**: Fixed at 400 lines
- **Strings**: English-only for Phase 1
- **Search**: Client-side filtering only
- **API**: No server persistence for settings (UI state only)

## Performance Notes

- Narrow Zustand selectors prevent unnecessary re-renders
- Memoized stanza splitting and filtering
- Windowing kicks in automatically for large content
- Error boundaries with graceful fallbacks

## Decolonial Guardrails

### Equal Visual Weight
- **Chips**: All dialect options styled identically - no hierarchy by dialect or style
- **No ranking**: No "primary" vs "secondary" button styling for different dialects
- **Visible tags**: Dialect labels shown on every option `(Std)`, `(Scots)`, `(Creole)`, `(Casual)`

### User Agency
- **Custom options**: "Add your own" allows users to input alternatives with `user:` prefix
- **Phrase grouping**: Users can merge/split at word/phrase level for granular control
- **Reversible navigation**: Back to Workshop maintains context, no forced workflow

### Transparent Process
- **Source visibility**: Original text shown in Workshop header for reference
- **Selection state**: Clear indication of what's selected vs. available
- **Compilation transparency**: Draft shows exactly what was compiled, no hidden changes

## Manual QA Checklist

### Phase 1 (Sidebar)
- [ ] Thread with source: numbered, grouped lines display correctly
- [ ] Search filters lines client-side
- [ ] Compact mode truncates long lines with hover titles
- [ ] Thread without source: shows empty message, no errors
- [ ] Partial analysis: displays known fields, placeholders for missing
- [ ] Settings: all controls update Zustand state immediately

### Phase 2 (Creative Loop)
- [ ] **Line Selection**: Select random lines → multi-select works → proceed to workshop
- [ ] **Workshop editing**: Choose dialect chips → add custom options → see immediate feedback
- [ ] **Grouping**: Group adjacent tokens → ungroup phrases → recompile → verify expected output
- [ ] **Compilation**: Compile 3 lines → verify text appears in notebook exactly as expected
- [ ] **Custom options**: Add `user:<text>` options → compile → verify custom text in output
- [ ] **Autosave/restore**: Refresh page → confirm preserved draft for same thread → switch threads → confirm isolation

### Accessibility & Performance
- [ ] **Keyboard-only**: Navigate chips, grouping menu, compile, views using only Tab/Enter/Arrow keys
- [ ] **Screen reader**: VoiceOver/NVDA announces token labels, dialect information, line position
- [ ] **Dark mode**: All components readable, focus rings visible in dark theme
- [ ] **Performance**: Load 300+ token line → smooth interaction → windowing "load more" works
- [ ] **Resize behavior**: Sidebar maintains width 320px-420px, main area responds

## Rollback Strategy

### Phase 2 Rollback
1. **Feature flag**: Set `NEXT_PUBLIC_FEATURE_SIDEBAR_LAYOUT=0` to disable entire V2 shell instantly
2. **Individual commits**: `git log --oneline` → `git revert <sha>` for specific features (no rebase required)
3. **Safe components**: Types, utilities, and hooks are additive and can remain

### No Server Impact
- **No API changes**: All Phase 2 features use client-side mock data and localStorage
- **No schema changes**: No new Supabase tables or columns added
- **No query keys**: Existing TanStack Query patterns unchanged

### Known Rollback Points
- `phase2(2.4)` - Remove phrase grouping utilities
- `phase2(2.3)` - Remove WorkshopView and TokenCard
- `phase2(2.2)` - Remove tokenization scaffold
- `phase2(2.1)` - Remove LineSelectionView
- `phase2(2.0)` - Remove workshop types and store extensions

### Clean Rollback
Phase 1 ContextSidebar can remain functional independently of Phase 2 creative loop components.