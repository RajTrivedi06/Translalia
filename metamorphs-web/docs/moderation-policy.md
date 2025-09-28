Purpose: Where and how moderation is enforced, and current/intent policies.
Updated: 2025-09-16

# Moderation Policy (2025-09-16)

## Model & Client

- Model: `omni-moderation-latest` via OpenAI moderations API.

```10:13:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/moderation.ts
const res = await client.moderations.create({
  model: "omni-moderation-latest",
  input: text.slice(0, 20000),
});
```

## Moderation Lifecycle

```mermaid
flowchart TD
  A[Request arrives] --> B{Surface}
  B -->|Enhancer| C[moderateText(poem)]
  B -->|Preview| D[moderateText(poem + enhanced)]
  B -->|Translate| E1[pre: moderateText(inputs)] --> E2[LLM call] --> E3[post: moderateText(output)]
  B -->|Accept-lines| F[moderateText(selections)]
  C -->|flagged| X1[Block 400]
  D -->|flagged| X2[Block 400]
  E1 -->|flagged| X3[Block 400]
  E3 -->|flagged| Y1[Set blocked=true]
  F -->|flagged| X4[Block 400]
  subgraph Logging
    L1[Redacted previews when DEBUG_PROMPTS=1]
  end
  E2 --> L1
```

- Redacted preview logging is gated by env.

```30:43:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/promptHash.ts
const DEBUG =
  process.env.DEBUG_PROMPTS === "1" ||
  process.env.NEXT_PUBLIC_DEBUG_PROMPTS === "1";
if (!DEBUG) return;
```

## Enforcement points (observed)

- Enhancer: block on flagged poem excerpt (`400`).

```44:49:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/enhancer/route.ts
const pre = await moderateText(poem);
if (pre.flagged) {
  return NextResponse.json(
    { error: "Poem content flagged by moderation; cannot enhance." },
    { status: 400 }
  );
}
```

- Translator Preview: pre-check source + enhanced; block `400` if flagged.

```116:123:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts
const pre = await moderateText(
  bundle.poem + "\n" + JSON.stringify(bundle.enhanced).slice(0, 4000)
);
if (pre.flagged)
  return NextResponse.json(
    { error: "Content flagged by moderation; cannot preview." },
    { status: 400 }
  );
```

- Translate (full): pre-check inputs; post-check outputs; block `400` on pre; set `blocked` flag on post.

```81:86:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const pre = await moderateText([poem, JSON.stringify(enhanced)].join("\n\n"));
if (pre.flagged) {
  return NextResponse.json(
    { error: "Content flagged by moderation; cannot translate." },
    { status: 400 }
  );
}
```

```142:148:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts
const post = await moderateText(
  parsedOut.data.versionA + "\n" + parsedOut.data.notes.join("\n")
);
const blocked = post.flagged;
const result = { ...parsedOut.data, blocked };
```

- Accept-lines: moderation on accepted text; block `400` if flagged.

```48:60:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/accept-lines/route.ts
const combined = selections.map((s) => s.text).join("\n");
const mod = await moderateText(combined);
if (mod.flagged) {
  return NextResponse.json(
    {
      ok: false,
      blocked: true,
      flagged: true,
      categories: mod.categories,
      error: "Selected lines flagged by moderation; not saved.",
    },
    { status: 400 }
  );
}
```

## Where/Model/Inputs/Outputs/Actions

| Where            | Model/endpoint                               | Inputs                      | Outputs (fields)        | Thresholds       | Action              | Anchor                                                                                                  |
| ---------------- | -------------------------------------------- | --------------------------- | ----------------------- | ---------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| Enhancer         | `moderations.create(omni-moderation-latest)` | poem excerpt                | `flagged`, `categories` | Provider default | Block 400           | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/enhancer/route.ts#L44-L49                |
| Preview          | `moderations.create(omni-moderation-latest)` | poem + enhanced(json slice) | `flagged`, `categories` | Provider default | Block 400           | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/preview/route.ts#L116-L123    |
| Translate (pre)  | `moderations.create(omni-moderation-latest)` | poem + enhanced             | `flagged`, `categories` | Provider default | Block 400           | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts#L81-L86               |
| Translate (post) | `moderations.create(omni-moderation-latest)` | candidate output + notes    | `flagged`, `categories` | Provider default | Mark result.blocked | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translate/route.ts#L142-L148             |
| Accept-lines     | `moderations.create(omni-moderation-latest)` | concatenated selections     | `flagged`, `categories` | Provider default | Block 400           | /Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/translator/accept-lines/route.ts#L48-L60 |

Helper output fields:

```16:19:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/moderation.ts
const flagged = !!first?.flagged;
const categories: Record<string, unknown> = first?.categories ?? {};
return { flagged, categories };
```

## Security Checklist (related)

- Auth required at sources of user input and storage; early returns on missing session.

```20:24:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/auth/requireUser.ts
/** Ensures a user session exists; returns 401 JSON response otherwise. */
export async function requireUser() {
  const supabase = await supabaseServer();
```

- Ownership checks for project/thread list and versions access.

```31:35:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/app/api/threads/list/route.ts
if (proj.owner_id !== user.id) {
  return NextResponse.json(
    { ok: false, code: "FORBIDDEN_PROJECT" },
    { status: 403 }
  );
}
```

- Secrets handling: do not log keys; reference names only; require presence.

```3:10:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/openai.ts
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
```

- Rate limits/quotas: local minute bucket and Upstash daily caps (verify/backtranslate).

```3:12:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/ratelimit.ts
export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
```

```26:39:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ratelimit/redis.ts
export async function checkDailyLimit(
  userId: string,
  key: string,
  max: number
) {
  const l = getLimiter();
  if (!l) return { allowed: true } as const;
```

- Link to services/envs: see `docs/context/SERVICES_INTEGRATIONS.md` (Supabase, OpenAI, Upstash env names).

## JSON Examples

- Moderation response we store (redacted example):

```json
{
  "flagged": true,
  "categories": { "self-harm": true, "violence": false }
}
```

- Enforcement decision object (example):

```json
{
  "action": "block",
  "reason": "precheck_flagged",
  "status": 400,
  "message": "Content flagged by moderation"
}
```

## Known gaps

- `MODERATION_MODEL` constant exists but call-site uses literal; consider aligning.

```15:15:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/models.ts
export const MODERATION_MODEL = "omni-moderation-latest";
```

```10:13:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/lib/ai/moderation.ts
model: "omni-moderation-latest",
```
