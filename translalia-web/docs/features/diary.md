# Diary Feature

## Overview

The Diary page displays all completed poems for the authenticated user, showing:
- Original source text
- Final line-by-line translations
- Notebook notes (thread notes and line notes)
- Latest journey summary (if generated)

## What is a "Completed Poem"?

A poem is considered "completed" when:
- `workshop_lines` exists in `chat_threads.state` and is a JSONB array
- Array length > 0
- No null elements in the array
- Every element has a non-empty `translated` field

This ensures that all lines of the poem have been translated and saved.

## Data Sources

The Diary feature pulls data from multiple sources:

### 1. `chat_threads.raw_poem` (column)
- **Type**: `text`
- **Purpose**: Original source poem text
- **Note**: This is a real column, not stored in `state->'raw_poem'`

### 2. `chat_threads.state->'workshop_lines'` (JSONB array)
- **Type**: `jsonb`
- **Structure**: Array of `WorkshopLineWithVerification` objects
- **Purpose**: Completed line-by-line translations
- **Format**: Each element contains `original`, `translated`, `completedAt`, etc.

### 3. `chat_threads.state->'notebook_notes'` (JSONB object)
- **Type**: `jsonb`
- **Structure**: `{ thread_note?: string | null, line_notes?: Record<number, string> }`
- **Purpose**: User's notes about the translation
- **Fields**:
  - `thread_note`: General reflection about the entire translation
  - `line_notes`: Object mapping line numbers to notes

### 4. `journey_ai_summaries` (table)
- **Type**: Relational table
- **Purpose**: AI-generated journey summaries
- **Fields used**:
  - `reflection_text`: Main narrative reflection
  - `insights`: Array of insights
  - `strengths`: Array of identified strengths
  - `challenges`: Array of identified challenges
  - `recommendations`: Array of recommendations
- **Note**: Only the **latest** summary per thread is returned (via LATERAL join)

## RPC Function

### `diary_completed_poems`

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

**Pagination**:
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

## API Endpoint

### `GET /api/diary/completed-poems`

**Authentication**: Required (uses `requireUser` from `@/lib/apiGuard`)

**Query Parameters**:
- `limit` (optional, default 20): Number of results (1-50)
- `beforeCreatedAt` (optional): ISO datetime string for cursor pagination
- `beforeId` (optional): UUID string for cursor pagination

**Response**:
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

**Cursor Logic**:
- If `items.length === limit`, `nextCursor` is set from the last item's `thread_created_at` and `thread_id`
- Client should pass these values as query params for the next page

## UI Component

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

## Navigation

The Diary link is added to the primary navigation in `src/components/auth/AuthNav.tsx`, accessible to all authenticated users.

## Internationalization

Translation keys are defined in `messages/en.json` under the `Diary` namespace:
- `title`, `heading`, `noCompletedPoems`
- `originalText`, `translatedText`
- `notes`, `threadNote`, `lineNotes`
- `journeySummary`, `insights`, `strengths`, `challenges`, `recommendations`
- `completedAt`, `loadMore`

## Testing

### Database
- **Schema validation**: Test RPC syntax in Supabase SQL editor
  - Note: Will often return 0 rows because `auth.uid()` is NULL in SQL editor context
  - This validates function exists and schema is correct, not functional behavior
- **Functional testing**: Test via API route (has proper auth context)

### API
- Test endpoint: `/api/diary/completed-poems?limit=20`
- Verify response includes `items` array
- Verify `nextCursor` appears when item count equals limit
- Test pagination with cursor parameters

### UI
- Verify Diary page shows poem cards
- Verify collapsible sections work
- Verify journey summary appears for threads that have it
- Verify "Load more" pagination works
- Verify empty state displays correctly
- Verify line-by-line translation display preserves formatting
