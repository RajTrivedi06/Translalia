# Database Interactions - Complete Reference

This document lists all database tables, columns, and their purposes as used in the Translalia application.

---

## Tables Overview

The application interacts with **9 main tables**:

1. `profiles` - User profile information
2. `projects` - Workspace containers for translation projects
3. `chat_threads` - Translation threads with server-owned JSON state
4. `chat_messages` - Chat/assistant messages (if used)
5. `journey_items` - Activity timeline entries
6. `journey_reflections` - User reflection entries
7. `prompt_audits` - Masked prompt/response audit logs
8. `uploads` - File uploads (referenced but not actively used)
9. `compares` - Version comparison records (legacy/optional)

---

## 1. `profiles`

**Purpose**: Stores user profile information, preferences, and account details.

### Columns

| Column        | Type         | Nullable | Purpose                                    |
| ------------- | ------------ | -------- | ------------------------------------------ |
| `id`          | uuid         | NOT NULL | Primary key, matches Supabase Auth user.id |
| `display_name`| text         | NULL     | User's display name                        |
| `username`    | text         | NULL     | Unique username                            |
| `email`       | text         | NULL     | User's email address                       |
| `avatar_url`  | text         | NULL     | URL to user's avatar image                 |
| `locale`      | text         | NULL     | User's preferred locale (e.g., "en", "es") |
| `created_at`  | timestamptz  | NOT NULL | Account creation timestamp                 |

### Relationships

- `id` → Supabase Auth `auth.users.id`

### Usage Patterns

**Read Operations:**
- Fetch user profile: `SELECT id, display_name, username, email, avatar_url, locale, created_at FROM profiles WHERE id = ?`
- Get locale preference: `SELECT locale FROM profiles WHERE id = ?`

**Write Operations:**
- Upsert profile on auth: `UPSERT profiles SET id=?, username=?, email=? ON CONFLICT(id)`

**Code References:**
- `src/hooks/useProfile.ts` - Profile fetching hook
- `src/lib/authHelpers.ts` - Profile creation/updates
- `src/app/api/journey/generate-brief-feedback/route.ts` - Locale lookup

---

## 2. `projects`

**Purpose**: Workspace container for organizing multiple translation threads. Each project belongs to a user and can contain multiple threads.

### Columns

| Column       | Type        | Nullable | Purpose                                          |
| ------------ | ----------- | -------- | ------------------------------------------------ |
| `id`         | uuid        | NOT NULL | Primary key                                      |
| `title`      | text        | NOT NULL | Project title (max 120 chars)                   |
| `owner_id`   | uuid        | NOT NULL | Foreign key → `profiles.id`                     |
| `src_lang`   | text        | NULL     | Source language for project                     |
| `tgt_langs`  | text[]      | NULL     | Target languages array                          |
| `created_at` | timestamptz | NOT NULL | Project creation timestamp                      |

### Relationships

- `owner_id` → `profiles.id` (projects belong to users)

### Usage Patterns

**Read Operations:**
- List user's projects: `SELECT id, title, created_at FROM projects WHERE owner_id = ? ORDER BY created_at DESC`
- Get project with ownership check: `SELECT id, owner_id FROM projects WHERE id = ?`

**Write Operations:**
- Create project: `INSERT INTO projects (title, owner_id, src_lang, tgt_langs) VALUES (?, ?, ?, ?) RETURNING id, title, created_at`
- Delete project: `DELETE FROM projects WHERE id = ? AND owner_id = ?`

**Code References:**
- `src/app/api/projects/route.ts` - Project CRUD operations
- `src/app/[locale]/(app)/workspaces/page.tsx` - Project listing
- `src/app/api/threads/list/route.ts` - Ownership verification

---

## 3. `chat_threads`

**Purpose**: The most important table. Stores translation threads with server-owned JSON state containing all translation data, settings, and progress.

### Columns

| Column       | Type        | Nullable | Purpose                                          |
| ------------ | ----------- | -------- | ------------------------------------------------ |
| `id`         | uuid        | NOT NULL | Primary key                                      |
| `project_id` | uuid        | NOT NULL | Foreign key → `projects.id`                     |
| `title`      | text        | NOT NULL | Thread title (max 120 chars)                    |
| `created_by` | uuid        | NOT NULL | Foreign key → `profiles.id`                     |
| `state`      | jsonb       | NULL     | **Server-owned JSON state** (see State Structure) |
| `created_at` | timestamptz | NOT NULL | Thread creation timestamp                       |

### `state` JSONB Structure

The `state` column contains nested JSON with the following top-level keys:

```typescript
{
  // Guide Rail settings
  guide_answers: GuideAnswers,              // User's translation preferences
  poem_analysis: { language?: string },     // Detected source language
  raw_poem: string,                         // Original poem text
  poem_stanzas: StanzaDetectionResult,      // Detected stanza structure

  // Recipe caching (Method 2)
  variant_recipes_v2: VariantRecipesBundle, // Cached recipe bundle

  // Translation job state
  translation_job: TranslationJobState,     // Job progress, chunks, queue

  // Audit trail
  method2_audit: LineAudit[],               // Translation audit records

  // Legacy fields (optional)
  notebook_notes?: {                        // Notebook notes
    threadNote?: string,
    lineNotes?: Record<number, string>
  },
  workshop_lines?: Record<number, string>   // Saved line translations
}
```

### Relationships

- `project_id` → `projects.id` (threads belong to projects)
- `created_by` → `profiles.id` (threads created by users)

### Usage Patterns

**Read Operations:**
- Get thread with state: `SELECT id, state, created_by, project_id FROM chat_threads WHERE id = ?`
- Get thread ownership: `SELECT id, created_by, project_id FROM chat_threads WHERE id = ?`
- List threads for project: `SELECT id, title, created_at FROM chat_threads WHERE project_id = ? ORDER BY created_at DESC`

**Write Operations:**
- Create thread: `INSERT INTO chat_threads (project_id, title, created_by, state) VALUES (?, ?, ?, '{}') RETURNING id, title, created_at`
- Update entire state: `UPDATE chat_threads SET state = ? WHERE id = ?` (with optimistic locking)
- Atomic field patch: Uses `patch_thread_state_field` RPC function
- Delete thread: `DELETE FROM chat_threads WHERE id = ?`

**Critical Notes:**
- **State is server-owned** - client should never directly modify it
- Uses **optimistic locking** via `state.translation_job.version`
- **Atomic operations** use RPC functions to prevent state clobbering

**Code References:**
- `src/lib/workshop/jobState.ts` - Job state management
- `src/server/guide/updateGuideState.ts` - Guide state updates
- `src/lib/ai/variantRecipes.ts` - Recipe caching in state
- `src/lib/ai/audit.ts` - Audit appending to state
- All workshop/notebook API routes read/write thread state

---

## 4. `chat_messages`

**Purpose**: Stores chat messages between users and assistants (if chat functionality is used). Currently referenced but may not be actively used.

### Columns

| Column       | Type        | Nullable | Purpose                                    |
| ------------ | ----------- | -------- | ------------------------------------------ |
| `id`         | uuid        | NOT NULL | Primary key                                |
| `project_id` | uuid        | NOT NULL | Foreign key → `projects.id`                |
| `thread_id`  | uuid        | NOT NULL | Foreign key → `chat_threads.id`            |
| `role`       | enum        | NOT NULL | Message role: 'user' \| 'assistant' \| 'system' |
| `content`    | text        | NOT NULL | Message content                            |
| `meta`       | jsonb       | NULL     | Additional metadata                        |
| `created_by` | uuid        | NULL     | User ID (for user messages)                |
| `created_at` | timestamptz | NOT NULL | Message timestamp                          |

### Relationships

- `project_id` → `projects.id`
- `thread_id` → `chat_threads.id`
- `created_by` → `profiles.id` (optional)

### Usage Patterns

**Write Operations:**
- Insert message: `INSERT INTO chat_messages (project_id, thread_id, role, content, meta, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, created_at`

**Note**: This table exists but appears to be legacy/unused in current implementation.

---

## 5. `journey_items`

**Purpose**: Activity timeline entries for a project, tracking user actions, reflections, and milestones.

### Columns

| Column       | Type        | Nullable | Purpose                                          |
| ------------ | ----------- | -------- | ------------------------------------------------ |
| `id`         | uuid        | NOT NULL | Primary key                                      |
| `project_id` | uuid        | NOT NULL | Foreign key → `projects.id`                     |
| `kind`       | text        | NOT NULL | Item type: "reflection", "compare", etc.         |
| `summary`    | text        | NULL     | Human-readable summary                           |
| `meta`       | jsonb       | NULL     | Additional metadata (type-specific)              |
| `created_at` | timestamptz | NOT NULL | Item creation timestamp                          |
| `compare_id` | uuid        | NULL     | Optional foreign key → `compares.id`             |

### Relationships

- `project_id` → `projects.id`
- `compare_id` → `compares.id` (optional)

### Usage Patterns

**Read Operations:**
- List journey items: `SELECT id, kind, summary, meta, created_at FROM journey_items WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`

**Write Operations:**
- Insert journey item: `INSERT INTO journey_items (project_id, kind, summary, meta, compare_id) VALUES (?, ?, ?, ?, ?)`

**Code References:**
- `src/app/api/journey/list/route.ts` - List journey items

---

## 6. `journey_reflections`

**Purpose**: Stores user reflections on their translation journey, including student reflection text and AI-generated feedback.

### Columns

| Column                  | Type        | Nullable | Purpose                                          |
| ----------------------- | ----------- | -------- | ------------------------------------------------ |
| `id`                    | uuid        | NOT NULL | Primary key                                      |
| `project_id`            | uuid        | NOT NULL | Foreign key → `projects.id`                     |
| `thread_id`             | uuid        | NOT NULL | Foreign key → `chat_threads.id`                 |
| `student_reflection`    | text        | NOT NULL | User's written reflection (10-5000 chars)       |
| `completed_lines_count` | integer     | NOT NULL | Number of completed translation lines           |
| `total_lines_count`     | integer     | NOT NULL | Total lines in poem                             |
| `status`                | text        | NOT NULL | Status: "reflection_only", "feedback_generated" |
| `ai_feedback`           | text        | NULL     | AI-generated feedback text                      |
| `created_by`            | uuid        | NOT NULL | Foreign key → `profiles.id`                     |
| `created_at`            | timestamptz | NOT NULL | Creation timestamp                              |
| `updated_at`            | timestamptz | NULL     | Last update timestamp                           |

### Relationships

- `project_id` → `projects.id`
- `thread_id` → `chat_threads.id`
- `created_by` → `profiles.id`

### Usage Patterns

**Read Operations:**
- Get reflection: `SELECT * FROM journey_reflections WHERE id = ?`
- Check ownership: `SELECT id, created_by FROM journey_reflections WHERE id = ?`

**Write Operations:**
- Create reflection: `INSERT INTO journey_reflections (project_id, thread_id, student_reflection, completed_lines_count, total_lines_count, status, created_by) VALUES (?, ?, ?, ?, ?, 'reflection_only', ?) RETURNING *`
- Update with feedback: `UPDATE journey_reflections SET ai_feedback = ?, status = 'feedback_generated', updated_at = NOW() WHERE id = ?`

**Code References:**
- `src/app/api/journey/save-reflection/route.ts` - Save user reflection
- `src/app/api/journey/generate-brief-feedback/route.ts` - Generate and save AI feedback

---

## 7. `prompt_audits`

**Purpose**: Stores masked audit logs of all OpenAI API calls for monitoring, debugging, and cost analysis. Prompts are automatically redacted to remove sensitive information.

### Columns

| Column            | Type        | Nullable | Purpose                                          |
| ----------------- | ----------- | -------- | ------------------------------------------------ |
| `id`              | uuid        | NOT NULL | Primary key                                      |
| `created_by`      | uuid        | NOT NULL | Foreign key → `profiles.id`                     |
| `project_id`      | uuid        | NULL     | Foreign key → `projects.id` (optional)          |
| `thread_id`       | uuid        | NULL     | Foreign key → `chat_threads.id` (optional)      |
| `stage`           | text        | NOT NULL | Stage: "workshop-options", "ai-assist", "prismatic", "journey-reflection", "poem-analysis", "interview", "context-feedback" |
| `provider`        | text        | NULL     | Provider name (e.g., "openai")                  |
| `model`           | text        | NOT NULL | Model used (e.g., "gpt-4o", "gpt-5")            |
| `params`          | jsonb       | NULL     | API parameters (duration_ms, etc.)              |
| `prompt_system`   | text        | NOT NULL | Masked system prompt                            |
| `prompt_user`     | jsonb       | NOT NULL | Masked user prompt (stored as `{masked: "..."}`) |
| `response_excerpt`| text        | NULL     | Response excerpt (first 400 chars)              |
| `redactions`      | text[]      | NULL     | Array of redaction types applied                |
| `created_at`      | timestamptz | NOT NULL | Audit record timestamp                          |

### Constraints

- `stage` must match allowed values (enforced by `prompt_audits_stage_check` constraint)

### Relationships

- `created_by` → `profiles.id`
- `project_id` → `projects.id` (optional)
- `thread_id` → `chat_threads.id` (optional)

### Usage Patterns

**Read Operations:**
- Get audit by ID: `SELECT * FROM prompt_audits WHERE id = ?`
- Get analytics: `SELECT stage, model, params FROM prompt_audits WHERE project_id = ? AND created_at > ?`
- List audits for verification: Filter by thread/project for analysis

**Write Operations:**
- Insert audit: `INSERT INTO prompt_audits (created_by, project_id, thread_id, stage, model, params, prompt_system, prompt_user, response_excerpt, redactions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`

**Code References:**
- `src/server/audit/insertPromptAudit.ts` - Audit insertion helper
- `src/lib/ai/openai.ts` - Automatic audit logging on all OpenAI calls
- `src/app/api/verification/grade/[auditId]/route.ts` - Retrieve audit for grading
- `src/app/api/verification/analytics/route.ts` - Analytics queries
- `src/app/api/verification/feedback/route.ts` - Feedback storage

---

## 8. `uploads`

**Purpose**: Stores file upload metadata. Referenced in code but may not be actively used in current implementation.

### Columns (Inferred)

| Column         | Type        | Nullable | Purpose                                    |
| -------------- | ----------- | -------- | ------------------------------------------ |
| `id`           | uuid        | NOT NULL | Primary key                                |
| `user_id`      | uuid        | NOT NULL | Foreign key → `profiles.id`                |
| `thread_id`    | uuid        | NULL     | Foreign key → `chat_threads.id` (optional) |
| `file_name`    | text        | NOT NULL | Original filename                          |
| `size_bytes`   | integer     | NOT NULL | File size in bytes                         |
| `storage_path` | text        | NOT NULL | Path in Supabase Storage                   |
| `created_at`   | timestamptz | NOT NULL | Upload timestamp                           |

### Relationships

- `user_id` → `profiles.id`
- `thread_id` → `chat_threads.id` (optional)

**Note**: This table appears to be legacy/unused in current snapshot.

---

## 9. `compares`

**Purpose**: Stores pairwise version comparison records. Appears to be legacy/optional feature.

### Columns (Inferred)

| Column           | Type        | Nullable | Purpose                                          |
| ---------------- | ----------- | -------- | ------------------------------------------------ |
| `id`             | uuid        | NOT NULL | Primary key                                      |
| `project_id`     | uuid        | NOT NULL | Foreign key → `projects.id`                     |
| `left_version_id`| uuid        | NOT NULL | Left version ID                                  |
| `right_version_id`| uuid       | NOT NULL | Right version ID                                 |
| `lens`           | enum        | NOT NULL | Comparison lens: 'meaning', 'form', 'tone', 'culture' |
| `granularity`    | enum        | NOT NULL | Granularity: 'line', 'phrase', 'char'            |
| `notes`          | text        | NULL     | Comparison notes                                 |

### Relationships

- `project_id` → `projects.id`

**Note**: Referenced in archive docs but not actively used in current codebase.

---

## Storage Buckets (Supabase Storage)

### `avatars`

**Purpose**: Stores user avatar images.

**Operations:**
- Upload: `supabase.storage.from('avatars').upload(path, file, { upsert: true })`
- Get public URL: `supabase.storage.from('avatars').getPublicUrl(path)`

**Code References:**
- `src/components/account/ProfileForm.tsx` - Avatar upload

---

## Database Functions (RPC)

### 1. `append_method2_audit`

**Purpose**: Atomically appends an audit entry to `chat_threads.state.method2_audit` array without clobbering other state fields.

**Parameters:**
- `p_thread_id` (uuid) - Thread ID
- `p_audit` (jsonb) - Audit record to append
- `p_max_n` (int, default 50) - Maximum entries to keep

**Returns:** boolean (success)

**Why it exists**: Prevents state clobbering when audit writes happen concurrently with translation job updates.

**Code References:**
- `src/lib/ai/audit.ts` - Used for all audit appends

---

### 2. `patch_thread_state_field`

**Purpose**: Atomically patches a single field path in `chat_threads.state` using `jsonb_set`.

**Parameters:**
- `p_thread_id` (uuid) - Thread ID
- `p_user_id` (uuid) - User ID (for ownership check)
- `p_path` (text[]) - JSON path array (e.g., `['guide_answers', 'translationIntent']`)
- `p_value` (jsonb) - Value to set

**Returns:** boolean (success)

**Why it exists**: Prevents state clobbering when updating individual state fields.

**Code References:**
- `src/server/guide/updateGuideState.ts` - Used for atomic state patches

---

### 3. `exec_sql`

**Purpose**: Generic SQL executor with parameter binding. Used for atomic JSONB updates.

**Parameters:**
- `query` (text) - SQL query with parameters
- `params` (jsonb, default []) - Parameter array

**Returns:** void

**Note**: This is a powerful function - use with caution. Prefer dedicated functions like `append_method2_audit` when possible.

**Code References:**
- `src/server/guide/updateGuideState.ts` - Fallback for atomic patches
- `src/app/api/debug/test-rpc/route.ts` - Testing/debugging

---

## Key State Fields in `chat_threads.state`

### `guide_answers` (GuideAnswers)

User's translation preferences from Guide Rail:

```typescript
{
  translationIntent?: string;
  sourceLanguageVariety?: string;
  viewpointRangeMode?: "focused" | "balanced" | "adventurous";
  translationModel?: "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo" | "gpt-5" | "gpt-5-mini";
  translationMethod?: "method-1" | "method-2";
  translationZone?: string;
  // Legacy fields...
}
```

### `translation_job` (TranslationJobState)

Translation progress tracking:

```typescript
{
  version: number;              // Optimistic locking version
  chunks: Record<number, TranslationChunkState>;
  queue: number[];              // Pending chunk indices
  active: number[];             // Currently processing chunk indices
  maxConcurrent: number;        // Concurrency limit
  status: "idle" | "processing" | "completed" | "failed";
  // ... more fields
}
```

### `variant_recipes_v2` (VariantRecipesBundle)

Cached recipe bundle for Method 2:

```typescript
{
  threadId: string;
  mode: ViewpointRangeMode;
  contextHash: string;
  recipes: [VariantRecipe, VariantRecipe, VariantRecipe];
  createdAt: number;
  modelUsed: string;
}
```

### `method2_audit` (LineAudit[])

Array of audit records for each translated line:

```typescript
{
  ts: string;
  threadId: string;
  lineIndex?: number;
  mode: TranslationRangeMode;
  model: string;
  recipe: { cacheHit: string; schemaVersion: string };
  gate: { pass: boolean; reason?: string; similarity?: {...} };
  regen?: { performed: boolean; strategy?: string; ... };
}[]
```

### `poem_stanzas` (StanzaDetectionResult)

Detected stanza structure:

```typescript
{
  stanzas: Array<{
    number: number;
    text: string;
    lines: string[];
    lineCount: number;
    startLineIndex: number;
  }>;
  totalStanzas: number;
  detectionMethod: "local" | "smart";
}
```

---

## Common Query Patterns

### Ownership Verification

```sql
-- Verify project ownership
SELECT id, owner_id FROM projects WHERE id = ? AND owner_id = ?;

-- Verify thread ownership
SELECT id, created_by, project_id FROM chat_threads WHERE id = ? AND created_by = ?;
```

### State Updates with Optimistic Locking

```sql
-- Update state with version check
UPDATE chat_threads
SET state = jsonb_set(state, '{translation_job}', ?::jsonb)
WHERE id = ? AND (state->'translation_job'->>'version')::int = ?;
```

### Atomic Field Updates

```sql
-- Use RPC for atomic updates
SELECT patch_thread_state_field(?, ?, ARRAY['guide_answers', 'translationIntent'], ?);
```

---

## Security Considerations

1. **RLS (Row Level Security)**: All tables should have RLS policies enforcing ownership
2. **State Ownership**: `chat_threads.state` is server-owned - clients should never directly modify it
3. **Optimistic Locking**: Translation job state uses version numbers to prevent concurrent modification
4. **Atomic Operations**: Critical state updates use RPC functions to prevent race conditions
5. **Audit Trail**: All OpenAI API calls are logged with masked prompts for compliance

---

## Database Interaction Summary

| Table              | Read Operations | Write Operations | Primary Use Case                    |
| ------------------ | --------------- | ---------------- | ----------------------------------- |
| `profiles`         | ✅ Frequent     | ✅ On auth       | User profile & preferences          |
| `projects`         | ✅ Frequent     | ✅ User actions  | Workspace management                |
| `chat_threads`     | ✅ Very Frequent| ✅ Very Frequent | Translation state & progress        |
| `chat_messages`    | ❌ Rare         | ❌ Rare          | Legacy chat (unused)                |
| `journey_items`    | ✅ Occasional   | ✅ Occasional    | Activity timeline                   |
| `journey_reflections` | ✅ Occasional | ✅ Occasional    | User reflections & AI feedback      |
| `prompt_audits`    | ✅ Analytics    | ✅ Auto-logged   | Audit trail & monitoring            |
| `uploads`          | ❌ Unused       | ❌ Unused        | Legacy file uploads                 |
| `compares`         | ❌ Unused       | ❌ Unused        | Legacy version comparisons          |

---

**Last Updated**: January 2026
