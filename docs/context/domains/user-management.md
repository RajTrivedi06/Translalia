### [Last Updated: 2025-11-04]

## User Management

### Overview

- Identity provider: Supabase Auth (email/password, OAuth). Application data for users lives in `profiles`, and ownership is enforced on domain resources (`projects`, `chat_threads`, etc.).

### Registration and onboarding flow

1. User signs up/signs in via Supabase client SDK (UI components not shown here)
2. Client posts auth event to `/api/auth` to synchronize SSR cookies for server routes

```20:29:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/auth/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { event, session } = body as { event?: SupabaseAuthEvent; session?: SupabaseSessionPayload };
  const res = NextResponse.json({ ok: true });
```

```46:60:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/auth/route.ts
if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
  if (session?.access_token && session?.refresh_token) {
    await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  }
}
if (event === "SIGNED_OUT") { await supabase.auth.signOut(); }
```

3. Middleware ensures protected app/API paths have Supabase cookies; otherwise redirects to sign‑in

```27:41:/Users/raaj/Documents/CS/metamorphs/translalia-web/middleware.ts
const needsAuth = pathname.startsWith("/workspaces") || pathname.startsWith("/api/threads") || pathname.startsWith("/api/flow") || pathname.startsWith("/api/versions");
if (needsAuth && !hasSupabaseCookies) { /* redirect to /auth/sign-in?redirect=... */ }
```

4. On first profile visit, `useProfile(user)` loads/creates a row and allows editing

```22:36:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/hooks/useProfile.ts
const { data, error } = await supabase
  .from("profiles")
  .select("id, display_name, username, email, avatar_url, locale, created_at")
  .eq("id", user.id)
  .single();
```

### User profile management

- Read/update profile via hook and form

```45:55:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/hooks/useProfile.ts
async function save(input: Partial<Profile>) {
  const payload = { id: user.id, ...input };
  const { data } = await supabase.from("profiles").upsert(payload).select().single();
  setProfile(data as Profile);
}
```

- Avatar upload to storage bucket `avatars`; form persists URL into profile

```40:52:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/account/ProfileForm.tsx
const path = `${user.id}/${Date.now()}_${file.name}`;
const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
if (!upErr) { const { data } = supabase.storage.from("avatars").getPublicUrl(path); if (data?.publicUrl) setAvatarUrl(data.publicUrl); }
```

### Account settings and preferences

- Managed within `profiles` fields: `display_name`, `username`, `avatar_url`, `locale`

```19:24:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/account/ProfileForm.tsx
setDisplayName(profile?.display_name ?? "");
setUsername(profile?.username ?? "");
setAvatarUrl(profile?.avatar_url ?? "");
setLocale(profile?.locale ?? "");
```

### User roles and permissions

- No app-specific role system implemented; authorization enforced via ownership checks and (external) Supabase RLS

```31:35:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/threads/list/route.ts
if (proj.owner_id !== user.id) { return NextResponse.json({ ok: false, code: "FORBIDDEN_PROJECT" }, { status: 403 }); }
```

### User lifecycle (creation, updates, deletion)

- Creation: Supabase Auth user row created on sign-up; profile row created/updated on first save
- Updates: Profile upsert; avatar stored in `avatars` bucket
- Deletion: Not implemented as an API route in this repo; can be handled via Supabase Admin or a future `/api/account/delete`

### User data privacy and GDPR

- Data categories: profile data (`profiles`), storage files (`avatars`), ownership on `projects`/`chat_threads`
- Best practices in code:
  - Never expose server-only secrets (e.g., `OPENAI_API_KEY`) to client bundles
  - Auth middleware restricts access to protected routes
  - Debug routes are marked temporary and should be disabled in production

```1:6:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/debug/whoami/route.ts
// TEMP DEBUG - REMOVE AFTER FIX
```

- Recommendations (future):
  - Add account export/delete endpoints; document data retention
  - Make `avatars` bucket access policy explicit; avoid public ACL if privacy required

### User session management

- SSR cookies synchronized via `/api/auth`; routes authenticate with cookie-bound client; Bearer fallback supported

```8:16:/Users/raaj/Documents/CS/metamorphs/translalia-web/middleware.ts
const supabase = createServerClient(/* url, anon, cookies */);
await supabase.auth.getUser();
```

```8:12:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/auth/whoami/route.ts
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
  return NextResponse.json({ ok: true, userId: guard.user.id });
}
```

### Summary

- Supabase Auth powers user identity; profiles store editable fields; resources are owned by users via `owner_id` or `created_by` columns; SSR cookies + optional Bearer token keep sessions consistent between client and server.
