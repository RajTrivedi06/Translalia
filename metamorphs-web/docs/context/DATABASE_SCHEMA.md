## Database Schema

### Overview

The application integrates with Supabase for authentication and persistence. This document captures core entities, relations, and data access patterns.

### Tech & Access

- Platform: Supabase (PostgreSQL)
- Clients: `lib/supabaseClient.ts` (browser), `lib/supabaseServer.ts` (server)
- Auth: Supabase Auth helpers in `lib/authHelpers.ts`

### Core Entities (Conceptual)

- Users: Authenticated users (from Supabase)
- Projects/Workspaces: Grouping for threads, versions, and assets
- Threads: Conversation containers for chat flows
- Messages: Items within a thread (user/assistant/system)
- Versions/Variants: Alternative outputs for compare workflows

Note: Refer to migrations (if present) or Supabase project UI for the authoritative schema. Update this section with exact table/column names as they evolve.

### Relationships (Conceptual)

- user 1..\* projects
- project 1..\* threads
- thread 1..\* messages
- project 1.._ versions and version 1.._ variants

### Migrations

- If using code-based migrations, document the workflow here (e.g., `supabase migration generate`, `db push`).
- Otherwise, track schema changes through ADRs or this doc.

### Query Patterns

- Client-side fetches should go through typed helpers or hooks when possible
- Prefer RLS-secured views/functions for cross-tenant safety
- Keep heavy joins server-side (in route handlers or `server/` modules)

### Performance & Indexing

- Add indexes for frequent filters: `project_id`, `thread_id`, `created_at`
- Consider composite indexes for `(project_id, created_at)` or `(thread_id, created_at)`

### Data Retention & Privacy

- Review `lib/policy.ts` and `docs/moderation-policy.md`
- Define retention windows for messages/artifacts per business policy

---

## DATABASE_SCHEMA

Note: Tables and columns are inferred from code usage. Verify in your Supabase project and adjust as needed.

### 1) All Supabase tables with columns and types (inferred)

- profiles

  - id (uuid, pk)
  - display_name (text, nullable)
  - username (text, unique, nullable)
  - email (text, nullable)
  - avatar_url (text, nullable)
  - locale (text, nullable)
  - created_at (timestamptz, default now())

- projects

  - id (uuid, pk)
  - title (text)
  - owner_id (uuid)
  - src_lang (text, nullable)
  - tgt_langs (text[], nullable)
  - created_at (timestamptz)

- chat_threads

  - id (uuid, pk)
  - project_id (uuid, fk → projects.id)
  - title (text)
  - state (jsonb) — server session state (`types/sessionState`)
  - created_by (uuid, fk → profiles.id)
  - created_at (timestamptz)

- chat_messages

  - id (uuid, pk)
  - project_id (uuid, fk → projects.id)
  - thread_id (uuid, fk → chat_threads.id)
  - role (text: 'user' | 'assistant' | 'system')
  - content (text)
  - meta (jsonb)
  - created_by (uuid, fk → profiles.id)
  - created_at (timestamptz)

- versions

  - id (uuid, pk)
  - project_id (uuid, fk → projects.id)
  - title (text)
  - lines (text[])
  - tags (text[])
  - meta (jsonb)
  - pos (jsonb, optional: {x:number, y:number})
  - created_at (timestamptz)

- compares

  - id (uuid, pk)
  - project_id (uuid, fk → projects.id)
  - left_version_id (uuid, fk → versions.id)
  - right_version_id (uuid, fk → versions.id)
  - lens (text: 'meaning'|'form'|'tone'|'culture')
  - granularity (text: 'line'|'phrase'|'char')
  - notes (text, nullable)
  - created_at (timestamptz)

- journey_items

  - id (uuid, pk)
  - project_id (uuid, fk → projects.id)
  - kind (text)
  - summary (text)
  - from_version_id (uuid, nullable, fk → versions.id)
  - to_version_id (uuid, nullable, fk → versions.id)
  - compare_id (uuid, nullable, fk → compares.id)
  - created_at (timestamptz)

- storage bucket: avatars
  - paths: `<userId>/<timestamp>_<filename>`

### 1.1) Constraints and defaults (recommended)

- Primary keys: `id uuid default gen_random_uuid()`
- Timestamps: `created_at timestamptz default now()`
- Foreign keys: `project_id`, `thread_id`, `created_by` with ON DELETE CASCADE where appropriate
- `chat_threads.state`: `jsonb not null default '{}'::jsonb`

### 2) Relationships between tables

- projects 1..\* chat_threads
- chat_threads 1..\* chat_messages
- projects 1..\* versions
- projects 1..\* compares
- projects 1..\* journey_items
- versions 1..\* compares (as left/right)

### 3) RLS policies in place (assumed)

- Enable RLS on all tables; policies should ensure users can only read/write rows for projects they own or are members of. Ensure `created_by` and `owner_id` are enforced in policies.

### 4) Database functions and triggers

- RPC: `accept_line(p_thread_id uuid, p_line_index int, p_new_text text, p_actor uuid)` — updates thread draft/accepted lines and logs decisions. Called by `/api/translator/accept-lines`.
- RPC: `get_accepted_version(p_thread_id uuid)` — returns an object with `{ lines: text[] }` used by `/api/translate` and translator preview bundling.

### 5) Indexes (recommended)

- On frequent filters: `(project_id)`, `(thread_id)`, `(created_at)`
- Composite: `(project_id, created_at)` on versions and journey_items
- Composite: `(thread_id, created_at)` on chat_messages

### 6) Sample queries for common operations

```ts
// Load project threads (newest first)
supabase
  .from("chat_threads")
  .select("id, title, created_at")
  .eq("project_id", projectId)
  .order("created_at", { ascending: false });

// Append a chat message
supabase
  .from("chat_messages")
  .insert({
    project_id,
    thread_id,
    role: "user",
    content,
    meta: {},
    created_by: userId,
  })
  .select("id, created_at")
  .single();

// Create a version
supabase
  .from("versions")
  .insert({ project_id, title, lines, tags, meta })
  .select("id, project_id, title, lines, tags, meta, created_at")
  .single();

// List nodes for a thread (mirrors /api/versions/nodes)
supabase
  .from("versions")
  .select("id, tags, meta, created_at")
  .eq("project_id", projectId)
  .filter("meta->>thread_id", "eq", threadId)
  .order("created_at", { ascending: true });

// Upsert node positions
supabase
  .from("versions")
  .upsert([{ id: versionId, pos: { x: 120, y: 40 } }], { onConflict: "id" });

// Journey items (latest N)
supabase
  .from("journey_items")
  .select("id, kind, summary, meta, created_at")
  .eq("project_id", projectId)
  .order("created_at", { ascending: false })
  .limit(20);

// Accept a translated line via RPC
supabase.rpc("accept_line", {
  p_thread_id: threadId,
  p_line_index: 3,
  p_new_text: "updated line",
  p_actor: userId,
});
```

### 7) Example CRUD SQL (seeding and sanity checks)

```sql
-- Project
insert into projects (id, title, owner_id, src_lang, tgt_langs)
values (gen_random_uuid(), 'Untitled Workspace', '00000000-0000-0000-0000-000000000000', 'en', array['ar']);

-- Thread
insert into chat_threads (id, project_id, title, created_by, state)
values (
  gen_random_uuid(),
  (select id from projects order by created_at desc limit 1),
  'Chat – seed',
  '00000000-0000-0000-0000-000000000000',
  '{}'::jsonb
);

-- Message
insert into chat_messages (id, project_id, thread_id, role, content, meta, created_by)
values (
  gen_random_uuid(),
  (select id from projects order by created_at desc limit 1),
  (select id from chat_threads order by created_at desc limit 1),
  'user',
  'Hello world',
  '{}'::jsonb,
  '00000000-0000-0000-0000-000000000000'
);

-- Version
insert into versions (id, project_id, title, lines, tags, meta)
values (
  gen_random_uuid(),
  (select id from projects order by created_at desc limit 1),
  'Seed Version',
  array['line 1','line 2'],
  array['translation'],
  jsonb_build_object('thread_id', (select id from chat_threads order by created_at desc limit 1))
);
```

### 8) TypeScript interfaces (DB-aligned)

```ts
export type DbProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  locale: string | null;
  created_at: string;
};

export type DbProject = {
  id: string;
  title: string;
  owner_id: string;
  src_lang: string | null;
  tgt_langs: string[] | null;
  created_at: string;
};

export type DbChatThread = {
  id: string;
  project_id: string;
  title: string | null;
  state: import("@/types/sessionState").SessionState | Record<string, unknown>;
  created_by: string;
  created_at: string;
};

export type DbChatMessage = {
  id: string;
  project_id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  meta: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
};

export type DbVersion = {
  id: string;
  project_id: string;
  title: string;
  lines: string[];
  tags: string[];
  meta: Record<string, unknown> | null;
  pos?: { x: number; y: number } | null;
  created_at: string;
};

export type DbCompare = {
  id: string;
  project_id: string;
  left_version_id: string;
  right_version_id: string;
  lens: "meaning" | "form" | "tone" | "culture";
  granularity: "line" | "phrase" | "char";
  notes: string | null;
  created_at: string;
};

export type DbJourneyItem = {
  id: string;
  project_id: string;
  kind: string;
  summary: string;
  from_version_id: string | null;
  to_version_id: string | null;
  compare_id: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
};
```

### 9) Query Patterns

- Thread-scope listing via `meta->>thread_id` on `versions` for node graph.
- Append-only journaling into `journey_items` for activity timelines.
- RPCs for write-heavy or policy-sensitive operations (`accept_line`, `get_accepted_version`).
- Prefer SELECT lists to `*` to control payload size and stability.

### 10) Conventions

- Use `uuid` identifiers across entities; avoid integer serials.
- Keep `meta jsonb` for extensibility; mirror key fields in typed columns when needed for indexes.
- Capture creator via `created_by` where RLS needs actor binding.

### 7) Migration history

- Track in Supabase Migrations if configured; otherwise document changes via ADRs. Current repo does not include migration files.
