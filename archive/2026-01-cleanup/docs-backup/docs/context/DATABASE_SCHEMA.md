Purpose: Tables, columns, and RPCs referenced in code, with evidence anchors.
Updated: 2025-11-04

# Database Schema (as used by code)

Note: This reflects tables/columns referenced in the repository. Supabase manages DDL/migrations externally; where exact constraints are unknown, they are inferred from usage.

## Entities (tables) and fields

### projects

- Purpose: Workspace container for threads/journey/uploads.
- Fields (observed): `id` (uuid, pk), `title` (text, <=120), `owner_id` (uuid, FK→profiles.id), `created_at` (timestamptz), `src_lang` (text|null), `tgt_langs` (text[]|null)

```19:27:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/projects/route.ts
.from("projects").insert({ title: safeTitle.slice(0,120), owner_id: guard.user.id, src_lang: ..., tgt_langs: ... }).select("id, title, created_at")
```

### chat_threads

- Purpose: Thread for chat/workshop/notebook activity, holds server-owned JSON state.
- Fields (observed): `id` (uuid, pk), `project_id` (uuid, FK→projects.id), `title` (text, <=120), `created_by` (uuid, FK→profiles.id), `created_at` (timestamptz), `state` (jsonb, default `{}`)

```26:34:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/threads/route.ts
.from("chat_threads").insert({ project_id: projectId, title: ..., created_by: guard.user.id }).select("id, title, created_at")
```

```72:75:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/cells/route.ts
.from("chat_threads").select("id,created_by,state").eq("id", params.threadId).single()
```

### chat_messages

- Purpose: Persist user/assistant messages by thread.
- Fields (observed): `id` (uuid, pk), `project_id` (uuid, FK→projects.id), `thread_id` (uuid, FK→chat_threads.id), `role` (enum: 'user'|'assistant'|'system'), `content` (text), `meta` (jsonb), `created_by` (uuid), `created_at` (timestamptz)

```23:33:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/chat/[threadId]/messages/route.ts
.from("chat_messages").insert({ project_id, thread_id, role, content, meta, created_by: guard.user.id }).select("id, created_at")
```

### journey_items

- Purpose: Activity timeline for a project (e.g., compares, analysis steps).
- Fields (observed): `id` (uuid, pk), `project_id` (uuid), `kind` (text), `summary` (text), `meta` (jsonb), `compare_id` (uuid|null), `created_at` (timestamptz)

```40:45:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/list/route.ts
.from("journey_items").select("id, kind, summary, meta, created_at").eq("project_id", projectId)
```

```49:54:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/compares/route.ts
await guard.sb.from("journey_items").insert({ project_id: projectId, kind: "compare", summary: ..., compare_id: c.id })
```

### compares

- Purpose: Record a comparison between two versions.
- Fields (observed): `id` (uuid, pk), `project_id` (uuid), `left_version_id` (uuid), `right_version_id` (uuid), `lens` (enum: 'meaning'|'form'|'tone'|'culture'), `granularity` (enum: 'line'|'phrase'|'char'), `notes` (text|null), `created_at` (timestamptz)

```31:44:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/compares/route.ts
.from("compares").insert({ project_id, left_version_id, right_version_id, lens, granularity, notes }).select("id, project_id, left_version_id, right_version_id, lens, granularity, created_at")
```

### uploads

- Purpose: Track file uploads per user/thread.
- Fields (observed): `file_name` (text), `size_bytes` (int8), `storage_path` (text|null), `created_at` (timestamptz), `thread_id` (uuid|null), `user_id` (uuid)

```15:23:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/uploads/list/route.ts
.from("uploads").select("file_name, size_bytes, storage_path, created_at, thread_id").eq("user_id", user.id)
```

### profiles

- Purpose: User profile metadata.
- Fields (observed): `id` (uuid, pk), `display_name` (text|null), `username` (text|null, unique), `email` (text|null), `avatar_url` (text|null), `locale` (text|null), `created_at` (timestamptz)

```30:35:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/hooks/useProfile.ts
.from("profiles").select("id, display_name, username, email, avatar_url, locale, created_at").eq("id", user.id).single()
```

```130:133:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/auth/AuthSheet.tsx
.from("profiles").upsert({ id: user.id, username, email }, { onConflict: "id" })
```

### Storage (Supabase)

- Buckets: `avatars` — user avatar images (not a table).

```42:49:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/account/ProfileForm.tsx
supabase.storage.from("avatars").upload(path, file, { upsert: true }); supabase.storage.from("avatars").getPublicUrl(path)
```

## Relationships (inferred)

- `projects.owner_id` → `profiles.id`
- `chat_threads.project_id` → `projects.id`
- `chat_threads.created_by` → `profiles.id`
- `chat_messages.project_id` → `projects.id`
- `chat_messages.thread_id` → `chat_threads.id`
- `uploads.user_id` → `profiles.id`
- `uploads.thread_id` → `chat_threads.id`
- `journey_items.project_id` → `projects.id`; optional `journey_items.compare_id` → `compares.id`
- `compares.project_id` → `projects.id`

## Indexes (policy intent)

- Common access patterns imply indexes on: `projects.owner_id`, `chat_threads.project_id`, `chat_messages.thread_id`, `uploads.user_id`, `uploads.thread_id`, `journey_items.project_id`, `journey_items.created_at DESC`.
- Unique: `profiles.username` (enforced app-side and typically DB-side).

## Enums / constants

- `chat_messages.role`: 'user' | 'assistant' | 'system'
- `compares.lens`: 'meaning' | 'form' | 'tone' | 'culture'
- `compares.granularity`: 'line' | 'phrase' | 'char'

## ER diagram (ASCII)

```
profiles (id) ─┬─< projects (owner_id)
               ├─< chat_threads (created_by)
               └─< uploads (user_id)

projects (id) ─┬─< chat_threads (project_id)
               ├─< journey_items (project_id)
               └─< compares (project_id)

chat_threads (id) ──< chat_messages (thread_id)
chat_threads (id) ──< uploads (thread_id)

compares (id) ── journey_items.compare_id (optional)
```

## Migration patterns (observed in code)

- Upsert on `profiles` keyed by `id` when saving profile fields.
- Insert with `select(...).single()` to return created rows (`projects`, `chat_threads`, `chat_messages`, `compares`).
- JSONB `state` on `chat_threads` used as server-owned session state.

## Sample queries (from code)

- Create project:

```19:27:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/projects/route.ts
.from("projects").insert({ title, owner_id: user.id }).select("id, title, created_at").single()
```

- Create thread:

```26:34:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/threads/route.ts
.from("chat_threads").insert({ project_id, title, created_by: user.id }).select("id, title, created_at").single()
```

- List journey items:

```40:45:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/list/route.ts
.from("journey_items").select("id, kind, summary, meta, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(limit)
```

- Insert chat message:

```23:33:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/chat/[threadId]/messages/route.ts
.from("chat_messages").insert({ project_id, thread_id, role, content, meta, created_by: user.id }).select("id, created_at").single()
```

- List uploads by user (+ optional thread):

```15:25:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/uploads/list/route.ts
.from("uploads").select("file_name, size_bytes, storage_path, created_at, thread_id").eq("user_id", user.id)
```

## Notes

- Some entities referenced in legacy docs (e.g., `versions`) are not used by the current snapshot of the app; they may exist in the database but are omitted here to reflect actual codepaths.
- For full DDL (PK/FK/indexes), export Supabase migrations and attach to this doc.
