## Authentication

### Overview

Supabase handles auth (email/password and OAuth). Client hooks manage session, and API routes enforce authentication via a server-side guard.

### Supported methods

- Email + password via `supabase.auth.signInWithPassword`
- OAuth (e.g., Google, GitHub) via `supabase.auth.signInWithOAuth`
- Sessions are JWT-based and automatically refreshed by `@supabase/supabase-js`

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

Also see `src/middleware.ts` which initializes a Supabase middleware client and fetches the session per request path, ensuring SSR pages and route handlers can read auth cookies reliably.

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
  // First try cookie-based auth, then fall back to Authorization: Bearer <token>
  const cookieStore = await cookies();
  let sb = createServerClient(url, anonKey, {
    cookies: cookieAdapter(cookieStore),
  });
  let { data: { user } = { user: null } } = await sb.auth.getUser();
  if (!user) {
    const authz = req.headers.get("authorization");
    if (authz?.startsWith("Bearer ")) {
      const token = authz.slice(7);
      sb = createServerClient(url, anonKey, {
        cookies: cookieAdapter(cookieStore),
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      ({ data: { user } = { user: null } } = await sb.auth.getUser());
    }
  }
  if (!user)
    return {
      user: null,
      sb,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  return { user, sb, res: null } as const;
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

### Roles and permissions

- Primary access control is enforced via Postgres RLS policies on Supabase tables.
- Recommended policies (not shown in repo):
  - `projects`: `owner_id = auth.uid()` for read/write; extend for collaborators.
  - Child tables (`chat_threads`, `chat_messages`, `versions`, `compares`, `journey_items`) restricted via `project_id` to projects the user can access.
- Application routes assume RLS is in place and use `requireUser` to attach the acting user.

### Role-based access control (RBAC)

- Database-level RBAC via RLS is recommended (not shown in repo).
- Enforce project membership in policies; check `owner_id`/`created_by` on rows.
- API routes assume RLS guards additional constraints.

### Authentication state in UI

- Hook: `useSupabaseUser` returns `{ user, loading }` bound to `onAuthStateChange`.
- Components like `AuthNav` render signin/signup or account/signout based on `user`.

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

### Error handling

- 401 Unauthorized from APIs → show toast in UI and/or redirect to `/auth/sign-in`.
- 403 Forbidden (e.g., feature disabled or RLS) → show access denied.
- Propagate Zod validation errors as `{ error: zodError.flatten() }` with 400.

### Example protected component (client)

```tsx
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

export function ProtectedArea({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSupabaseUser();
  if (loading) return <div>Loading…</div>;
  if (!user) return <SignInCTA />;
  return <>{children}</>;
}
```

### Implementation Checklist (LLM)

- Wire `middleware.ts` to initialize session.
- Use `supabaseServer()` in server components/route handlers.
- Use `requireUser(req)` in any route that writes to DB.
- Support Bearer token fallback for client `fetch` calls.
- Gate protected UI with `useSupabaseUser()`; include sign-in/up links.
- Return 401/403 with actionable JSON messages; avoid leaking internals.
- RLS: ensure policies restrict rows to project members; add indexes for `project_id`, `created_by`.
