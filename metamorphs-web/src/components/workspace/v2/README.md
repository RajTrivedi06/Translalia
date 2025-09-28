# V2 Workspace Sidebar

Phase 1 implementation of the Context Sidebar with three cards: Source, Analysis, and Settings.

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

## Manual QA Checklist

- [ ] Thread with source: numbered, grouped lines display correctly
- [ ] Search filters lines client-side
- [ ] Compact mode truncates long lines with hover titles
- [ ] Thread without source: shows empty message, no errors
- [ ] Partial analysis: displays known fields, placeholders for missing
- [ ] Settings: all controls update Zustand state immediately
- [ ] Dark mode: proper contrast, focus rings visible
- [ ] Keyboard navigation: logical tab order, all controls accessible
- [ ] Resize behavior: sidebar maintains width 320px-420px
- [ ] Performance: >500 lines render smoothly with windowing

## Rollback Strategy

1. Revert ContextSidebar layout to previous version
2. Feature flag in Phase 0 can disable entire V2 shell
3. Helper utilities are additive and safe to keep
4. No query key or API changes made