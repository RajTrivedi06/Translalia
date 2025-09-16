Purpose: Auth/session patterns, ownership checks, secrets/flags, and policy gaps.
Updated: 2025-09-16

### [Last Updated: 2025-09-16]

# Security Guidelines (2025-09-16)

## Authentication & Sessions

- Server-side Supabase client (SSR) with cookies adapter:

```7:10:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/supabaseServer.ts
return createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
```

- Route guards enforce authentication and return early:

```5:9:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/auth/requireUser.ts
/** Ensures a user session exists; returns 401 JSON response otherwise. */
export async function requireUser() {
  const supabase = await supabaseServer();
```

```45:47:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const { user: currentUser, response } = await requireUser();
if (!currentUser) return response;
```

- Guard with request context (alternate pattern):

```11:22:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/apiGuard.ts
export async function requireUser(
  req: NextRequest
) {
  const cookieStore = await cookies();
  // ... create cookie-based client; fallback to Bearer
```

## Ownership & Authorization

- Example: verify project ownership before listing threads.

```21:35:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/threads/list/route.ts
const { data: proj } = await sb
  .from("projects")
  .select("id, owner_id")
  .eq("id", projectId)
  .single();
if (!proj)
  return NextResponse.json({ ok: false, code: "PROJECT_NOT_FOUND" }, { status: 404 });
if (proj.owner_id !== user.id) {
  return NextResponse.json({ ok: false, code: "FORBIDDEN_PROJECT" }, { status: 403 });
}
```

- Example: thread-to-project scoping used when reading versions for a thread.

```21:38:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/nodes/route.ts
.from("chat_threads").select("id, project_id").eq("id", threadId)
// then filter versions by project_id and meta->>thread_id
.from("versions").select("id, tags, meta, created_at").eq("project_id", th.project_id)
.filter("meta->>thread_id", "eq", threadId)
```

> RLS: Application code assumes table-level Row Level Security policies enforce per-project/per-user access.

## Cookies & Headers

- Cookie-based SSR client; APIs may also accept `Authorization: Bearer <token>` from the Supabase session on the client.

```26:27:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useNodes.ts
headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
```

## Secrets & Environment Variables

- Keep server secrets out of logs. Names only (values redacted): `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

```4:8:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/openai.ts
apiKey: process.env.OPENAI_API_KEY!,
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
```

## Feature Flags & Exposure

- Use `NEXT_PUBLIC_FEATURE_*` for client-visible gating; routes enforce feature availability on server.

```28:30:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
if (process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR !== "1") {
  return new NextResponse("Feature disabled", { status: 403 });
}
```

## Policy Intent (gaps)

- Feature-off responses should standardize on 403; some routes currently use 404.
- Include `Retry-After` headers on 429 local limits/quotas; current 429s return JSON without header.

```3:10:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/http/errors.ts
/** Convert LLM client errors to concise HTTP responses, preserving Retry-After on 429. */
export function respondLLMError(e: any) {
  const retryAfter = e?.response?.headers?.get?.("retry-after");
  const res = NextResponse.json({ error: e?.message ?? "LLM error" }, { status });
  if (retryAfter) res.headers.set("Retry-After", String(retryAfter));
}
```
