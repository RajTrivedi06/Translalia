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

### Auth Patterns

| Entry point       | Guard type          | Failure behavior      | Anchor                                                                                 |
| ----------------- | ------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| Cookie SSR helper | SSR cookie (server) | 401 JSON when missing | ```4:11:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/auth/requireUser.ts |

/\*_ Ensures a user session exists; returns 401 JSON response otherwise. _/
export async function requireUser() {
const supabase = await supabaseServer();
const { data, error } = await supabase.auth.getUser();
if (error || !data?.user)
return {
user: null as any,
response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
};
}

````|
| API guard (cookie → Bearer) | SSR cookie or Authorization: Bearer | 401 JSON when none | ```35:45:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/apiGuard.ts
if (authH.toLowerCase().startsWith("bearer ")) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sbBearer = createSupabaseClient(url, anon, {
    global: { headers: { Authorization: authH } },
  }) as unknown as SupabaseClient;
}
``` |
| Supabase SSR client | Cookie wiring | Reads/writes cookies | ```4:13:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/supabaseServer.ts
export function supabaseServer() {
  const cookieStore = cookies() as any;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name) { return cookieStore.get(name)?.value; }, set(name, value, options) { cookieStore.set({ name, value, ...options }); }, remove(name, options) { cookieStore.set({ name, value: "", path: options?.path ?? "/", httpOnly: options?.httpOnly ?? true, secure: process.env.NODE_ENV === "production", sameSite: (options?.sameSite as any) ?? "lax", maxAge: 0, expires: new Date(0), ...options, }); } } }
  );
}
``` |

Example (protected list route):

```16:21:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/versions/nodes/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get("threadId");
  if (!threadId)
    return NextResponse.json({ ok: false, error: "MISSING_THREAD_ID" }, { status: 400 });
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
````

### Protected route template

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";
import { z } from "zod";

const Body = z.object({
  /* fields */
});
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );

  // business logic
  return NextResponse.json({ ok: true });
}
```

### JSON: Protected route config (LLM consumption)

```json
{
  "guard": "cookie_or_bearer",
  "rate_limit": {
    "bucket": "example:${threadId}",
    "limit": 30,
    "window_ms": 60000
  },
  "cache": {
    "key_template": "example:${stableHash(payload)}",
    "ttl_sec": 3600
  },
  "errors": [400, 401, 403, 404, 409, 429, 500, 502]
}
```

Scenario: Bearer token present but invalid → 401

```36:50:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/apiGuard.ts
const authH = req.headers.get("authorization") || "";
if (authH.toLowerCase().startsWith("bearer ")) {
  const { data: u2, error: e2 } = await sbBearer.auth.getUser();
  if (!u2?.user)
    return { res: NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 }) } as const;
}
```
