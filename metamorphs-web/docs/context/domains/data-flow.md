## Data Flow

### Overview: DB → API → Client

- Server APIs live in `src/app/api/**/route.ts` and orchestrate DB access via Supabase.
- Client fetches via React Query or direct `fetch()` to routes; some UI uses Supabase client for read-only queries.
- Middleware (`src/middleware.ts`) primes Supabase session cookies for SSR and routes.

### Database → UI examples

1. Chat messages list

```ts
// src/hooks/useThreadMessages.ts
supabase
  .from("chat_messages")
  .select("id, role, content, meta, created_at, created_by")
  .eq("project_id", projectId!)
  .eq("thread_id", threadId!)
  .order("created_at", { ascending: true });
```

2. Workspace bootstrap (versions, journey, compares)

```ts
// src/components/workspace/WorkspaceShell.tsx
const [v, j, c] = await Promise.all([
  supabase
    .from("versions")
    .select("id, title, lines, tags, meta, created_at")
    .eq("project_id", projectId),
  supabase
    .from("journey_items")
    .select(
      "id, kind, summary, from_version_id, to_version_id, compare_id, created_at"
    )
    .eq("project_id", projectId),
  supabase
    .from("compares")
    .select(
      "id, left_version_id, right_version_id, lens, granularity, created_at"
    )
    .eq("project_id", projectId),
]);
```

### Caching strategy

- API-level cache: translator preview uses in-memory cache (`lib/ai/cache.ts`) keyed by stable hash of inputs.

```ts
// src/app/api/translator/preview/route.ts
const key = "translator_preview:" + stableHash(bundle);
const cached = await cacheGet(key);
if (cached)
  return NextResponse.json({ ok: true, preview: cached, cached: true });
await cacheSet(key, preview, 3600);
```

- Client cache: React Query caches query results by `queryKey`.
- Nodes list is polled frequently (`useNodes`) with `cache: "no-store"` on the route.

### Optimistic updates

- Versions are appended locally after `/api/variants` + `/api/versions` create.

```tsx
// src/components/workspace/chat/ChatPanel.tsx
addVersion({
  id: saved.version.id,
  title: saved.version.title,
  lines: saved.version.lines,
  tags: saved.version.tags ?? [],
});
```

### Error boundaries and handling

- API returns typed JSON with appropriate HTTP codes (400/401/404/409/429/502).
- UI shows inline error messages or toasts. Example:

```ts
// translator preview
return NextResponse.json(
  { error: "Translator output malformed", raw },
  { status: 502 }
);
```

### Loading states

- React Query `isFetching`/mutation pending used in UI for spinners and disabled buttons.

```tsx
// src/hooks/useInterviewFlow.ts & consumer components
const { isFetching } = useThreadMessages(projectId, threadId);
```

### Data validation pipeline

- Zod validates inputs in API routes (`lib/schemas.ts` or local schemas).

```ts
// src/app/api/threads/route.ts
const parsed = createThreadSchema.safeParse(await req.json());
if (!parsed.success)
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
```

### API → DB flows (selected)

1. Create thread

```ts
// /api/threads POST
const { thread } = await sb
  .from("chat_threads")
  .insert({ project_id, title, created_by: user.id })
  .select("id, title, created_at")
  .single();
```

2. Flow start → state update

```ts
// /api/flow/start POST
await patchThreadState(threadId, {
  phase: "interviewing",
  poem_excerpt: poem,
  collected_fields: {},
});
```

3. Translator preview → cache → persist overview to versions placeholder

```ts
// /api/translator/preview POST
await cacheSet(key, preview, 3600);
await sb
  .from("versions")
  .update({ meta: { ...meta, status: "generated", overview } })
  .eq("id", placeholderId);
```

### Data invalidation

- Invalidate React Query after mutations (e.g., `flow_peek`, `journey`).
- Remove nodes cache on thread switch to avoid bleed (`WorkspaceShell`).

### Real-time updates

- No DB realtime at present; polling is used for nodes, React Query refetch for journey/messages.
