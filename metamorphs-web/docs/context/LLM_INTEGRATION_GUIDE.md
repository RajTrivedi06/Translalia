## LLM Integration Guide

### Purpose

How to use this documentation set to generate accurate code across APIs, flows, services, and UI.

### Navigation

- API endpoints: `docs/context/API_ROUTES.md`, `docs/llm-api.md`, `docs/flow-api.md`
- Data schema: `docs/context/DATABASE_SCHEMA.md`
- Components: `docs/context/COMPONENTS_STRUCTURE.md`
- Services: `docs/context/SERVICES_INTEGRATIONS.md`
- Policies: `docs/moderation-policy.md`, `docs/spend-and-cache-policy.md`, `docs/flags-and-models.md`
- State & relationships: `docs/context/STATE_MANAGEMENT.md`, `docs/context/RELATIONSHIPS.md`

### Code Generation Templates

```ts
// Protected route handler template
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";
import { z } from "zod";

const Body = z.object({
  /* fields */
});
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (guard.res) return guard.res;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  // ... business logic
  return NextResponse.json({ ok: true });
}
```

```ts
// LLM call with cache + validation
import { getOpenAI } from "@/lib/ai/openai";
import { stableHash, cacheGet, cacheSet } from "@/lib/ai/cache";
import { SomeZodSchema } from "@/types/llm";

const key = "prefix:" + stableHash(payload);
const cached = await cacheGet(key);
if (cached) return cached;
const client = getOpenAI();
const resp = await client.chat.completions.create({ model, messages });
const parsed = SomeZodSchema.safeParse(parseRaw(resp));
if (!parsed.success)
  return NextResponse.json({ error: "LLM output invalid" }, { status: 502 });
await cacheSet(key, parsed.data, 3600);
```

### Relationship to Docs

- Use API routes docs for shapes and statuses; DB schema for columns and relations; policies for gating and cost controls.

### Quality Guardrails

- Always validate inputs and outputs (Zod).
- Use `requireUser` and respect feature flags.
- Prefer caches and rate limits on hot endpoints.

### Bad vs Good

- Bad: persisting model text without validation, calling LLM on every keystroke, ignoring 401/403.
- Good: schema-validated outputs, idempotent cached calls, explicit HTTP status handling.
