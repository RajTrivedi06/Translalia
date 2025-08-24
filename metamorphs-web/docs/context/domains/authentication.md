## Authentication

### Overview

Supabase handles auth (email/password and OAuth). Client hooks manage session, and API routes enforce authentication via a server-side guard.

### Complete flow: login → session → logout

- Sign-in UI uses username-or-email resolution, then `signInWithPassword`.
- Session is maintained by Supabase; client listens to `onAuthStateChange` and server uses cookie-based SSR client.
- Logout signs out via Supabase client and refreshes UI.

#### Sign in (username or email)

Path: `src/app/auth/sign-in/page.tsx`

```tsx
// src/app/auth/sign-in/page.tsx
const email = await resolveIdentifierToEmail(identifier);
const { error } = await supabase.auth.signInWithPassword({ email, password });
```

Resolver:

```ts
// src/lib/authHelpers.ts
export async function resolveIdentifierToEmail(
  identifier: string
): Promise<string> {
  if (identifier.includes("@")) return identifier.toLowerCase();
  const { data } = await supabase
    .from("profiles")
    .select("email")
    .eq("username", identifier)
    .single();
  if (!data?.email) throw new Error("No account found for that username.");
  return data.email.toLowerCase();
}
```

#### Session management (client)

Path: `src/hooks/useSupabaseUser.ts`

```ts
// src/hooks/useSupabaseUser.ts
const { data } = await supabase.auth.getUser();
const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
  setUser(session?.user ?? null);
});
```

#### Session management (server)

Path: `src/lib/supabaseServer.ts`

```ts
// src/lib/supabaseServer.ts
return createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { cookies: cookieAdapter }
);
```

#### Logout

Paths: `src/components/auth/AuthButton.tsx`, `src/components/auth/AuthNav.tsx`

```tsx
// src/components/auth/AuthNav.tsx
await supabase.auth.signOut();
router.refresh();
```

### Protected routes (APIs)

Use a guard that validates the Supabase session and injects a server client.
Path: `src/lib/apiGuard.ts`

```ts
// src/lib/apiGuard.ts
export async function requireUser(req: NextRequest) {
  const sb = makeServerClientWithAuth(req);
  const { data } = await sb.auth.getUser();
  if (!data?.user)
    return {
      user: null,
      sb,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  return { user: data.user, sb, res: null };
}
```

Example usage:

```ts
// src/app/api/threads/route.ts
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (guard.res) return guard.res;
  // ... proceed with authenticated logic
}
```

### Protected pages (patterns)

- Server components: use `supabaseServer()` to check session and redirect unauthenticated users.
- Client components: gate render with `useSupabaseUser()` and show sign-in links.

Example server-check (pattern):

```ts
// app/(app)/workspace/page.tsx (pattern)
const sb = await supabaseServer();
const { data } = await sb.auth.getUser();
if (!data.user) redirect("/auth/sign-in");
```

### Role-based access control (RBAC)

- Database-level RBAC via RLS is recommended (not shown in repo).
- Enforce project membership in policies; check `owner_id`/`created_by` on rows.
- API routes assume RLS guards additional constraints.

### Password reset flow

- Not wired in pages yet; Supabase supports password recovery via OTP link.
- Pattern:
  1. `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
  2. On the redirect page, call `supabase.auth.updateUser({ password: newPwd })`.

### Social auth

Path: `src/components/auth/AuthSheet.tsx`

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo },
});
await supabase.auth.signInWithOAuth({
  provider: "github",
  options: { redirectTo },
});
```
