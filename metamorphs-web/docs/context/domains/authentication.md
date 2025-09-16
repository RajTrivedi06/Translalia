### [Last Updated: 2025-09-16]

## Authentication

### Methods

- Supabase Auth (email/password, OAuth) with SSR cookies for API routes and Bearer fallback for client calls.

### Guards & Permissions

- Server routes use one of two guards:
  - Simple guard (SSR cookie only):

```4:11:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/auth/requireUser.ts
/** Ensures a user session exists; returns 401 JSON response otherwise. */
export async function requireUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error or !data?.user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
}
```

- Full guard (SSR cookie or Authorization header):

```35:50:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/apiGuard.ts
if (authH.toLowerCase().startsWith("bearer ")) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sbBearer = createSupabaseClient(url, anon, {
    global: { headers: { Authorization: authH } },
  }) as unknown as SupabaseClient;
  const { data: u2 } = await sbBearer.auth.getUser();
}
```

### Cookie vs Header

- Cookie-based SSR client:

```7:13:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/supabaseServer.ts
return createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { cookies: { get, set, remove } }
)
```

- Header-based Bearer fallback (API-only): see guard above.

### Sample protected-route template

```16:25:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/route.ts
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
  const parsed = createVersionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}
```

### WhoAmI/Debug

- Auth debug route returns cookie names and user id when present:

```6:15:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/auth/debug-cookies/route.ts
export async function GET() {
  const cookieStore = await cookies();
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return NextResponse.json({ cookie_names: cookieStore.getAll().map((c)=>c.name), uid: data?.user?.id ?? null });
}
```
