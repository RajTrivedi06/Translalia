---
title: Phase 0.2–0.3 Repo Audit
updated: 2025-09-26
role: CursorDocs
---

## Summary Table

- **Supabase clients**: Pass
- **Storage helpers & uploads APIs**: Pass
- **Health & timing**: Pass
- **Rate-limit header**: Fail (missing Retry-After on 429 in translator APIs)
- **UI language groundwork**: Pass
- **Uploads UI state & components**: Pass (mounted on demo workspace page)
- **Notebook panel**: Pass (mounted in Chats right column; no Summary component mounted)
- **Workspace skeleton**: Pass
- **Env & secrets**: Partial (no .env.example present; no client misuse of service role)

## Findings

### Supabase clients

- `src/lib/env.ts` → exports `env`, `assertEnv` (OK)

```1:13:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/env.ts
export const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};

export function assertEnv() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL)
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
```

- `src/lib/supabaseBrowser.ts` → starts with "use client", exports `createBrowserClient()` (OK)

```1:21:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/supabaseBrowser.ts
"use client";
...
export function createBrowserClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
}
```

- `src/lib/supabaseServer.ts` → exports `getServerClient()` (OK)

```1:37:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/supabaseServer.ts
export function getServerClient() {
  const cookieStore = cookies();
  const hdrs = headers();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { ... }, headers: { ... } }
  );
}
```

- `src/lib/supabaseAdmin.ts` → has "use server", exports `createAdminClient()`; no imports from client files (OK)

```1:20:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/supabaseAdmin.ts
"use server";
...
export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (server-only).");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
```

### Storage helpers & APIs

- `src/lib/storage.ts` → BUCKET, `buildPath`, `getSignedUrl`, `removeObject` (OK)

```1:51:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/storage.ts
export const BUCKET = process.env.STORAGE_BUCKETS_CORPORA ?? "corpora";
export function buildPath({ userId, threadId, fileName, objectId }) { ... }
export async function getSignedUrl(path: string, expiresInSec = 300) { ... }
export async function removeObject(path: string) { ... }
```

- `src/app/api/uploads/sign/route.ts` → POST, checks `corpora/{user.id}/...`, returns `{ url, expiresAt }` (OK)

```10:40:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/uploads/sign/route.ts
export async function POST(req: Request) {
  ...
  const requiredPrefix = `${BUCKET}/${user.id}/`;
  if (!body.path.startsWith(requiredPrefix)) { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { url, expiresAt } = await getSignedUrl(body.path, 300);
  return NextResponse.json({ url, expiresAt });
}
```

- `src/app/api/uploads/delete/route.ts` → POST, checks ownership by prefix, calls `removeObject` (OK)

```10:44:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/uploads/delete/route.ts
export async function POST(req: Request) {
  ...
  const requiredPrefix = `${BUCKET}/${user.id}/`;
  if (!body.path.startsWith(requiredPrefix)) { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  await removeObject(body.path);
  return NextResponse.json({ ok: true });
}
```

### Health & timing

- `src/app/api/health/route.ts` → GET returns `{ ok: true, ts }` (OK)

```2:6:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/health/route.ts
export async function GET() {
  return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
    headers: { "content-type": "application/json" },
  });
}
```

- `src/lib/http/timing.ts` → `withTiming(name, fn)` sets Server-Timing (OK)

```2:14:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/http/timing.ts
export async function withTiming(name: string, fn: () => Promise<Response>) {
  const t0 = performance.now();
  const res = await fn();
  const t1 = performance.now();
  ...
  newHeaders.set("Server-Timing", value);
  return new Response(res.body, { status: res.status, headers: newHeaders });
}
```

### Rate-limit header

- Helper found: `src/lib/ai/ratelimit.ts` returns `retryAfterSec` value (OK)

```1:16:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/ratelimit.ts
if (b.count >= limit) {
  const retryAfterSec = Math.max(1, Math.ceil((b.until - now) / 1000));
  return { ok: false, remaining: 0, retryAfterSec } as const;
}
```

- 429 emitters do not set Retry-After header (Fail):

```21:30:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/verify/route.ts
if (!rl.allowed)
  return NextResponse.json(
    { error: "Daily verification limit reached" },
    { status: 429 }
  );
```

```21:30:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/backtranslate/route.ts
if (!rl.allowed)
  return NextResponse.json(
    { error: "Daily back-translation limit reached" },
    { status: 429 }
  );
```

Note: `src/lib/http/errors.ts` supports setting `Retry-After`, but these routes aren’t using it.

### UI language groundwork

- `src/state/uiLang.ts` exists and defaults from `NEXT_PUBLIC_UI_LANG_DEFAULT` (OK)

```1:11:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/state/uiLang.ts
const DEFAULT = process.env.NEXT_PUBLIC_UI_LANG_DEFAULT ?? "en";
export const useUiLangStore = create<UiLangState>({ ... });
```

- `src/lib/i18n/config.ts` exports `getDefaultUiLang()` (OK)

```1:4:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/i18n/config.ts
export function getDefaultUiLang() {
  return process.env.NEXT_PUBLIC_UI_LANG_DEFAULT ?? "en";
}
```

### Uploads UI state & components

- `src/state/uploads.ts` → items/add/remove (OK)

```1:21:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/state/uploads.ts
export const useUploadsStore = create<UploadsState>((set) => ({ items: [], add: ..., remove: ..., clear: ... }));
```

- Components exist and are used on the demo workspace page (OK)

```5:6:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/(app)/workspace/page.tsx
import UploadsTray from "@/components/chat/UploadsTray";
import AttachmentButton from "@/components/chat/AttachmentButton";
```

```64:70:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/(app)/workspace/page.tsx
<AttachmentButton onFiles={onFiles} />
...
<UploadsTray items={items} />
```

### Notebook panel

- Notebook exists and is mounted in the Chats right column (OK)

```5:12:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/journey/JourneyPanel.tsx
<div className="px-4 py-3 font-semibold">Notebook</div>
<NotebookPanel />
```

- No Summary component mounted on that page (OK)

```186:189:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/workspace/WorkspaceShell.tsx
{/* Right: Journey / Summary */}
<Panel ...>
  <JourneyPanel />
</Panel>
```

### Workspace skeleton

- `src/app/(app)/workspace/page.tsx` renders 3-pane demo (OK)

```57:91:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/(app)/workspace/page.tsx
<main className="mx-auto max-w-[1400px] p-4">
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
    <Pane className="lg:col-span-3">...</Pane>
    <Pane className="lg:col-span-6">...</Pane>
    <Pane className="lg:col-span-3">...</Pane>
  </div>
</main>
```

### Env & secrets

- `.env.example` missing (recommend adding). No client usage of `SUPABASE_SERVICE_ROLE_KEY` found (OK)

```1:21:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/supabaseAdmin.ts
"use server"; ... env.SUPABASE_SERVICE_ROLE_KEY
```

## Actionable Fixes

- Add Retry-After on 429 responses in translator APIs:

  - `src/app/api/translator/verify/route.ts` → set `Retry-After` using `jsonError(429, msg, { retryAfterSec })`.
  - `src/app/api/translator/backtranslate/route.ts` → same as above.

- Add `.env.example` with variable names only:
  - Include: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKETS_CORPORA`, `NEXT_PUBLIC_UI_LANG_DEFAULT`.

## Next checks

- Wire Supabase uploads end-to-end in Phase 1 (client upload -> sign URL -> PUT -> log).
- Expand 429 handling across all rate-limited routes.
- Add tests for storage path ownership validation.
