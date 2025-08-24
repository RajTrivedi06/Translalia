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
```

### 7) Migration history

- Track in Supabase Migrations if configured; otherwise document changes via ADRs. Current repo does not include migration files.
