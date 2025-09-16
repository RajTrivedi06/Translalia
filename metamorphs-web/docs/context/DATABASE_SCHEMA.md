Purpose: Tables, columns, and RPCs referenced in code, with evidence anchors.
Updated: 2025-09-16

# Database Schema (Excerpts from Code)

Note: This document reflects tables/columns referenced in code. For full schema (indexes/constraints), consult migrations (TODO: add migration dump).

## Tables referenced

### projects

- Columns used: `id`, `owner_id`

```21:25:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/threads/list/route.ts
const { data: proj } = await sb
  .from("projects")
  .select("id, owner_id")
  .eq("id", projectId)
  .single();
```

### chat_threads

- Columns used: `id`, `project_id`, `title`, `state`, `created_at`

```21:25:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/nodes/route.ts
const { data: th } = await sb
  .from("chat_threads")
  .select("id, project_id")
  .eq("id", threadId)
  .single();
```

```38:42:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/threads/list/route.ts
const { data, error } = await sb
  .from("chat_threads")
  .select("id, title, created_at")
  .eq("project_id", projectId)
```

```47:49:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/instruct/route.ts
const { data: th } = await supabase
  .from("chat_threads")
  .select("id, project_id, state")
```

### versions

- Columns used: `id`, `project_id`, `title`, `lines`, `tags`, `meta`, `created_at`, `pos`

```124:134:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const { data: inserted } = await sb
  .from("versions")
  .insert({
    project_id: projectId,
    title: displayLabel,
    lines: [],
    meta: placeholderMeta,
    tags: ["translation"],
  })
  .select("id")
  .single();
```

```33:38:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/nodes/route.ts
const { data, error } = await sb
  .from("versions")
  .select("id, tags, meta, created_at")
  .eq("project_id", th.project_id)
```

```28:33:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/positions/route.ts
const { error } = await sb
  .from("versions")
  .upsert(updates, { onConflict: "id" });
```

### journey_items

- Columns used: `project_id`, `kind`, `summary`, `compare_id`, `created_at`

```43:45:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/route.ts
await guard.sb.from("journey_items").insert({
  project_id: v.project_id,
```

### compares

- Columns used: `id`, `project_id`, `left_version_id`, `right_version_id`, `lens`, `granularity`, `created_at`

```31:33:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/compares/route.ts
const { data: c, error } = await guard.sb
  .from("compares")
  .insert({
```

## RPCs

- `get_accepted_version(p_thread_id uuid)`

```61:64:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const { data: accepted } = await supabase.rpc("get_accepted_version", {
  p_thread_id: threadId,
});
```

- `accept_line(p_thread_id uuid, ...)` (used elsewhere)

```63:69:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/accept-lines/route.ts
for (const s of selections) {
  await supabase.rpc("accept_line", {
    p_thread_id: threadId,
    p_line_index: s.index + 1,
    p_new_text: s.text,
    p_actor: userId,
  });
}
```

## Notable constraints/indexes (policy intent)

- Project ownership is enforced by checking `projects.owner_id` before listing threads.

```31:35:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/threads/list/route.ts
if (proj.owner_id !== user.id) {
  return NextResponse.json(
    { ok: false, code: "FORBIDDEN_PROJECT" },
    { status: 403 }
  );
}
```

- Thread-to-project join is used to scope versions queries via `project_id` and `meta->>thread_id` filter.

```33:38:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/nodes/route.ts
.from("versions")
.select("id, tags, meta, created_at")
.eq("project_id", th.project_id)
.filter("meta->>thread_id", "eq", threadId)
```

## Lineage fields (in versions.meta)

- `thread_id`: identifies the thread; used with `meta->>thread_id` filter in nodes API.
- `parent_version_id`: links a version to its parent; used by UI to render lineage edges.

```33:40:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/nodes/route.ts
const { data, error } = await sb
  .from("versions")
  .select("id, tags, meta, created_at")
  .eq("project_id", th.project_id)
  .filter("meta->>thread_id", "eq", threadId)
  .order("created_at", { ascending: true });
```

## Journey items read pattern

Currently filtered by `meta->>thread_id`:

```59:66:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/server/translator/bundle.ts
const { data: jrows } = await supabase
  .from("journey_items")
  .select("id, kind, summary, created_at, meta")
  .filter("meta->>thread_id", "eq", threadId)
  .order("created_at", { ascending: false })
  .limit(5);
```

> TODO-VERIFY: migrate to a dedicated `thread_id` column on `journey_items` when available.

> TODO: Pull full DDL from migrations to document PKs, FKs, and indexes.
