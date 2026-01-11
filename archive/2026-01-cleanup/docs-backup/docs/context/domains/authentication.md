### [Last Updated: 2025-11-04]

## Authentication

### Overview

- Provider: Supabase Auth (email/password, OAuth) with SSR cookies for server routes and Bearer token fallback for client→API calls.
- Model: session-based via Supabase cookies; optional Authorization: Bearer access token for API requests.

### Authentication flow

1. Client signs in via Supabase (client SDK) → emits auth events
2. Client posts event + session to `/api/auth` to sync SSR cookies

```20:29:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/auth/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { event, session } = body as { event?: SupabaseAuthEvent; session?: SupabaseSessionPayload };
  const res = NextResponse.json({ ok: true });
```

```29:41:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/auth/route.ts
const supabase = createServerClient(/* url, anon */, { cookies: { getAll(){ return req.cookies.getAll(); }, setAll(c){ c.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); } } });
```

```46:60:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/auth/route.ts
if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
  if (session?.access_token && session?.refresh_token) {
    await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  }
}
if (event === "SIGNED_OUT") { await supabase.auth.signOut(); }
```

3. Middleware ensures cookies are present; redirects if missing for protected paths

```25:41:/Users/raaj/Documents/CS/metamorphs/translalia-web/middleware.ts
const needsAuth = pathname.startsWith("/workspaces") || pathname.startsWith("/api/threads") || pathname.startsWith("/api/flow") || pathname.startsWith("/api/versions");
const hasSupabaseCookies = Array.from(req.cookies.getAll()).some((c) => c.name.startsWith("sb-") || c.name.includes("supabase"));
if (needsAuth && !hasSupabaseCookies) {
  const url = new URL("/auth/sign-in", origin);
  url.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}
```

### Login/logout implementation

- Login: Supabase client in the browser (not shown here) triggers `SIGNED_IN` event; `/api/auth` sets SSR cookies
- Logout: Supabase client triggers `SIGNED_OUT`; `/api/auth` clears cookies via `supabase.auth.signOut()`

### Token generation and validation

- Tokens are generated and validated by Supabase; app consumes them via cookies or `Authorization: Bearer <access_token>`
- API guard prefers cookies; falls back to Bearer to create a scoped client

```12:22:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/apiGuard.ts
export async function requireUser(req: NextRequest): Promise<GuardOk | GuardFail> {
  // 1) Try cookie-bound session via App Router helper
  // ...
  // 2) Fallback: Authorization: Bearer <access_token>
}
```

```35:49:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/apiGuard.ts
const authH = req.headers.get("authorization") || "";
if (authH.toLowerCase().startsWith("bearer ")) {
  const sbBearer = createSupabaseClient(url, anon, { global: { headers: { Authorization: authH } } });
  const { data: u2 } = await sbBearer.auth.getUser();
  if (u2?.user) return { user: { id: u2.user.id }, sb: sbBearer };
}
```

### Session management

- SSR session cookies managed in middleware and `/api/auth`; server routes obtain a cookie-bound client

```8:16:/Users/raaj/Documents/CS/metamorphs/translalia-web/middleware.ts
const supabase = createServerClient(/* url, anon */, { cookies: { getAll(){ return req.cookies.getAll(); }, setAll(cookiesToSet){ cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); } } });
await supabase.auth.getUser();
```

- WhoAmI for verification

```8:12:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/auth/whoami/route.ts
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
  return NextResponse.json({ ok: true, userId: guard.user.id });
}
```

### Permission and role system

- No app-specific roles detected; authorization enforced via ownership checks in routes

```21:35:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/threads/list/route.ts
const { data: proj } = await sb.from("projects").select("id, owner_id").eq("id", projectId).single();
if (!proj) return NextResponse.json({ ok: false, code: "PROJECT_NOT_FOUND" }, { status: 404 });
if (proj.owner_id !== user.id) return NextResponse.json({ ok: false, code: "FORBIDDEN_PROJECT" }, { status: 403 });
```

- Thread ownership verified before access/mutation

```84:92:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
if (threadErr || !thread) { return err(404, "THREAD_NOT_FOUND", "Thread not found."); }
if (thread.created_by !== user.id) { return err(403, "FORBIDDEN", "You do not have access to this thread."); }
```

### Protected route implementation

- Template guard + Zod + early returns

```8:15:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/projects/route.ts
const guard = await requireUser(req);
if ("res" in guard) return guard.res;
const parsed = createProjectSchema.safeParse(await req.json());
if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
```

### API authentication middleware

- Middleware redirects unauthenticated users from protected app and API paths; excludes static assets via matcher

```27:33:/Users/raaj/Documents/CS/metamorphs/translalia-web/middleware.ts
const needsAuth = pathname.startsWith("/workspaces") || pathname.startsWith("/api/threads") || pathname.startsWith("/api/flow") || pathname.startsWith("/api/versions");
```

```47:51:/Users/raaj/Documents/CS/metamorphs/translalia-web/middleware.ts
export const config = { matcher: [ "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:js|css|png|jpg|jpeg|gif|svg|ico)$).*)" ] };
```

### Security best practices implemented

- Server-only `OPENAI_API_KEY`; never exposed to client
- SSR cookie synchronization to ensure server reads respect client login state
- Ownership checks before reads/writes; consistent 401/403/404/409/429/5xx status mapping
- Auth debug routes are marked for non-production usage only

```1:6:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/debug/whoami/route.ts
// TEMP DEBUG - REMOVE AFTER FIX
```

- Middleware matcher excludes static assets to avoid unnecessary auth processing

### Summary

- Supabase-backed session auth with SSR cookies; Bearer fallback supported in API guard.
- Routes compose guard + Zod validation + early ownership checks for defense-in-depth.
