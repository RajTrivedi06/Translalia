### [Last Updated: 2025-11-04]

## Relationships Map

### Frontend ⇄ Backend communication
- App Router fetch with Supabase Bearer when present; falls back to cookies
```19:33:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/(app)/workspaces/[projectId]/page.tsx
const { data, refetch, isFetching } = useQuery({
  enabled: !!projectId,
  queryKey: ["chat_threads", projectId],
  queryFn: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    const res = await fetch(`/api/threads/list?projectId=${projectId}`, { cache: "no-store", credentials: "include", headers });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error || payload?.code || "THREADS_LIST_FAILED");
    return (payload.items ?? []) as Thread[];
  },
});
```
- API routes require auth via guard (cookie first, then Bearer)
```12:22:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/apiGuard.ts
export async function requireUser(
  req: NextRequest
): Promise<GuardOk | GuardFail> {
  // 1) Try cookie-bound session via App Router helper
  const cookieStore = await cookies();
  // ...
  // 2) Fallback: Authorization: Bearer <access_token>
}
```

### Service-to-service dependencies
- Supabase (DB/Auth): SSR client per request; client SDK in UI
```51:61:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { cookies: { get: (name) => cookieStore.get(name)?.value, set() {}, remove() {} } }
);
```
- OpenAI (LLM): singleton client; used by guide/notebook/interview routes
```1:10:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ai/openai.ts
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, });
export function getOpenAI() { if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing"); return openai; }
```
- Optional Upstash Redis (quotas): helper stub for daily limits
```176:191:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/ratelimit/redis.ts
export async function checkDailyLimit(userId: string, key: string, max: number) { /* ... */ }
```

### Module import/export relationships (selected)
- API routes import guards, models, and AI helpers
```1:8:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
import { requireUser } from "@/lib/auth/requireUser";
import { openai } from "@/lib/ai/openai";
import { TRANSLATOR_MODEL } from "@/lib/models";
import { supabaseServer } from "@/lib/supabaseServer";
import { cacheGet, cacheSet } from "@/lib/ai/cache";
import { checkDailyLimit } from "@/lib/ratelimit/redis";
```
- UI pulls state via hooks and calls API via fetch; avoids direct DB writes
```19:41:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/(app)/workspaces/[projectId]/page.tsx
const { data, refetch, isFetching } = useQuery({ /* fetch /api/threads/list */ });
```

### Data flow between layers
- Example: Notebook Prismatic
  - UI posts to `/api/notebook/prismatic` → route validates (Zod), auth (Supabase SSR), reads `chat_threads`, builds prompts, calls OpenAI, returns JSON
```12:24:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
const BodySchema = z.object({ threadId: z.string().min(1), lineIndex: z.number().int().min(0), sourceText: z.string().min(1), });
function ok<T>(data: T, status = 200) { return NextResponse.json(data as any, { status }); }
function err(status: number, code: string, message: string, extra?: any) { return NextResponse.json({ error: { code, message, ...extra } }, { status }); }
```
- Example: Journey List
  - UI fetches `/api/journey/list?projectId=...` with optional Bearer → route validates query, uses token or cookies to list `journey_items`
```30:45:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/list/route.ts
const hdrs = await headers();
const auth = hdrs.get("authorization") || "";
const token = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;
const supabase = token ? createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } }) : await supabaseServer();
const { data, error } = await supabase.from("journey_items").select("id, kind, summary, meta, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(limit);
```

### External service dependencies
- Supabase: Auth, Postgres, Storage (avatars)
- OpenAI: Chat Completions, Responses API (adapter), Moderations
- Optional: Upstash Redis for quotas/rate-limits

### Dependency injection patterns
- Singleton clients (OpenAI) and per-request clients (Supabase SSR). Guards return a ready client and user identity for downstream use.
```9:18:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/apiGuard.ts
type GuardOk = { user: { id: string }; sb: SupabaseClient };
...
if (u1?.user) return { user: { id: u1.user.id }, sb: sbCookie };
```
- Model selection injected via env and passed into routes
```1:8:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/models.ts
export const TRANSLATOR_MODEL = process.env.TRANSLATOR_MODEL?.trim() || "gpt-4o";
export const ENHANCER_MODEL = process.env.ENHANCER_MODEL?.trim() || "gpt-5-mini";
export const ROUTER_MODEL = process.env.ROUTER_MODEL?.trim() || "gpt-5-nano-2025-08-07";
export const EMBEDDINGS_MODEL = process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-3-large";
```

### ASCII dependency graph
```
UI (React/Next)
  ├─ State (Zustand) ───────► Hooks (TanStack Query)
  │                             │
  │                             └─ fetch() ───────► API Routes (Next Route Handlers)
  │                                                   │
  │                                                   ├─ Auth Guard (cookies→Bearer) ──► Supabase SSR Client
  │                                                   │                                   └─ Postgres (tables: projects, chat_threads, journey_items, versions, uploads)
  │                                                   ├─ LLM Helpers (OpenAI client) ──► OpenAI APIs (chat/responses/moderation)
  │                                                   ├─ Cache/RateLimit (in-memory) ──► Map-based TTL and token bucket
  │                                                   └─ Models/env (selection) ───────► process.env
  │
  └─ Components (WorkspaceShell, ChatPanel, VersionCanvas, etc.)
        └─ Consume hooks/store; render UI; no direct DB writes
```

### Component and service relationships (selected)
- `WorkspaceShell` → `ChatPanel`, `VersionCanvas`, `JourneyPanel`
- `ChatPanel` → fetch chat messages, peek/flows, and notebook/guide routes
- `VersionCanvas` → nodes data (versions lineage)
- `JourneyPanel` → journey list
- Services: OpenAI used by `guide/analyze-poem`, `notebook/prismatic`, `interview/next`
```1:8:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/guide/analyze-poem/route.ts
import OpenAI from "openai";
import { ENHANCER_MODEL } from "@/lib/models";
```
```1:8:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/interview/next/route.ts
import { ROUTER_MODEL } from "@/lib/models";
import { openai } from "@/lib/ai/openai";
```

### Notes
- UI never writes to DB directly; writes go through API routes.
- Guards centralize auth and client creation; routes stay thin and compose helpers.
- Feature flags and model envs influence route behavior without changing UI code.
