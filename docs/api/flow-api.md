Purpose: Contracts and behaviors for flow-related API endpoints (guide, journey, notebook, workshop, interview), with auth, schemas, examples, and limits.
Updated: 2025-11-04

### [Last Updated: 2025-11-04]

# Flow API (2025-11-04)

All endpoints are thread-scoped where applicable and auth-guarded unless stated.

## Endpoints Index

| Route                              | Method | Request schema (TS/Zod)                                        | Response schema                           | Auth | Errors                       | Anchors                                            |
| ---------------------------------- | ------ | -------------------------------------------------------------- | ----------------------------------------- | ---- | ---------------------------- | -------------------------------------------------- |
| `/api/guide/analyze-poem`          | POST   | `{ poem: string; threadId: string }`                           | `{ analysis: {...}, saved: boolean }`     | Yes  | 400, 401, 403, 404, 500, 502 | `src/app/api/guide/analyze-poem/route.ts`          |
| `/api/journey/generate-reflection` | POST   | `{ threadId: string; context: {...} }`                         | `{ reflection: {...}, modelUsed: string}` | Yes  | 400, 401, 403, 404, 500, 502 | `src/app/api/journey/generate-reflection/route.ts` |
| `/api/notebook/cells`              | GET    | `?threadId=string`                                             | `{ cells: NotebookCell[] }`               | Yes  | 400, 401, 403, 404, 500      | `src/app/api/notebook/cells/route.ts`              |
| `/api/notebook/ai-assist`          | POST   | `RequestSchema` (selected words, cell/thread ids, instruction) | `AIAssistResponse` (typed)                | Yes  | 400, 401, 404, 500, 502      | `src/app/api/notebook/ai-assist/route.ts`          |
| `/api/notebook/prismatic`          | POST   | `{ threadId: string; lineIndex: number; sourceText: string }`  | `{ variants: Array<{label,text,...}> }`   | Yes  | 400, 401, 403, 404, 500, 502 | `src/app/api/notebook/prismatic/route.ts`          |
| `/api/workshop/generate-options`   | POST   | `{ threadId: string; lineIndex: number; lineText: string }`    | `GenerateOptionsResponse`                 | Yes  | 400, 401, 404, 429?, 500     | `src/app/api/workshop/generate-options/route.ts`   |
| `/api/workshop/save-line`          | POST   | `{ threadId: string; lineIndex: number; selections: [...] }`   | `{ ok: true; translatedLine; lineIndex}`  | Yes  | 400, 401, 404, 500           | `src/app/api/workshop/save-line/route.ts`          |
| `/api/interview/next`              | POST   | `{ gap: string; baseQuestion: string; context?: object }`      | `{ question: string }`                    | Yes  | 401, 404 (feature), 502      | `src/app/api/interview/next/route.ts`              |

## Schemas and Types (evidence)

### Guide: Analyze Poem

```12:15:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/guide/analyze-poem/route.ts
const BodySchema = z.object({
  poem: z.string().min(1, "poem is required"),
  threadId: z.string().min(1, "threadId is required"),
});
```

Response and persistence:

```156:173:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/guide/analyze-poem/route.ts
const content = completion.choices?.[0]?.message?.content?.trim() || "{}";
const analysis = JSON.parse(content);
...
return ok({ analysis, saved: true });
```

Auth and thread checks:

```53:74:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/guide/analyze-poem/route.ts
const { data: userRes, error: authErr } = await supabase.auth.getUser();
...
if (thread.created_by !== user.id) {
  return err(403, "FORBIDDEN", "You do not have access to this thread.");
}
```

### Journey: Generate Reflection

```11:23:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/generate-reflection/route.ts
const BodySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  context: z.object({
    poemLines: z.array(z.string()),
    completedLines: z.record(z.string()),
    totalLines: z.number(),
    completedCount: z.number(),
    guideAnswers: z.object({}).passthrough(),
    translationZone: z.string().nullable().optional(),
    translationIntent: z.string().nullable().optional(),
    progressPercentage: z.number(),
  }),
});
```

```227:229:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/generate-reflection/route.ts
return ok({ reflection, modelUsed: modelToUse });
```

### Notebook: Cells

```12:14:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/cells/route.ts
const QuerySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
});
```

Returns `NotebookCell[]`:

```95:105:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/cells/route.ts
const cells: NotebookCell[] = sourceLines.map(
  (sourceLine: any, index: number) => {
    ...
    return {
      id: `cell-${index}`,
      lineIndex: index,
      source: { ... },
      translation: { ... },
      notes: ..., footnotes: ..., prismaticVariants: ..., metadata: { ... },
    };
  }
);
```

### Notebook: AI Assist

```16:43:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
const RequestSchema = z.object({
  threadId: z.string().uuid(),
  cellId: z.string(),
  selectedWords: z.array(z.object({ id: z.string(), text: z.string(), ... })),
  sourceLineText: z.string(),
  instruction: z.enum(["refine","rephrase","expand","simplify"]).optional(),
});
```

```45:51:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
const ResponseSchema = z.object({
  cellId: z.string(),
  suggestion: z.string(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string().optional(),
  alternatives: z.array(z.string()).optional(),
});
```

### Notebook: Prismatic Variants

```12:16:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
const BodySchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  lineIndex: z.number().int().min(0),
  sourceText: z.string().min(1, "sourceText is required"),
});
```

### Workshop: Generate Options

```15:19:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/workshop/generate-options/route.ts
const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  lineText: z.string(),
});
```

```28:33:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/workshop/generate-options/route.ts
const ResponseSchema = z.object({
  lineIndex: z.number(),
  words: z.array(WordOptionSchema),
  modelUsed: z.string().optional(),
});
```

### Workshop: Save Line

```11:16:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/workshop/save-line/route.ts
const RequestSchema = z.object({
  threadId: z.string().uuid(),
  lineIndex: z.number().int().min(0),
  originalLine: z.string().optional(),
  selections: z.array(SelectionSchema),
});
```

```111:115:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/workshop/save-line/route.ts
return NextResponse.json({
  ok: true,
  translatedLine,
  lineIndex,
});
```

### Interview: Next Clarifying Question (feature-off)

```7:12:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/interview/next/route.ts
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  if (!isSmartInterviewLLMEnabled())
    return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
```

## Authentication

- Most endpoints require a signed-in user and verify thread ownership via Supabase cookies.

```63:69:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/cells/route.ts
const { data: userRes, error: authErr } = await supabase.auth.getUser();
if (authErr || !user) {
  return err(401, "UNAUTHENTICATED", "Please sign in.");
}
```

## Responses and Errors

- Standard JSON `{ error: { code, message, ... } }` on failures with 4xx/5xx.

```20:31:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/guide/analyze-poem/route.ts
function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}
```

Common status codes:

- 400 invalid body/query
- 401 unauthenticated
- 403 forbidden (ownership)
- 404 not found (thread)
- 500 internal, 502 upstream LLM contract

## Usage Examples

Analyze poem (POST):

```http
POST /api/guide/analyze-poem
Content-Type: application/json
{
  "poem": "...",
  "threadId": "uuid"
}
```

```json
{ "analysis": { "language": "en", "tone": ["lyrical"], ... }, "saved": true }
```

Notebook AI assist (POST):

```http
POST /api/notebook/ai-assist
Content-Type: application/json
{ "threadId":"uuid","cellId":"cell-3","selectedWords":[...],"sourceLineText":"...","instruction":"refine" }
```

```json
{
  "cellId": "cell-3",
  "suggestion": "...",
  "confidence": 85,
  "alternatives": ["...", "..."]
}
```

Workshop save line (POST):

```http
POST /api/workshop/save-line
Content-Type: application/json
{ "threadId":"uuid","lineIndex":0,"selections":[{"position":0,"selectedWord":"..."}] }
```

```json
{ "ok": true, "translatedLine": "...", "lineIndex": 0 }
```

## Rate Limits and Constraints

- In this snapshot, daily quota helper returns allowed; endpoints include 429 patterns where enabled later.

```83:99:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
const rateCheck = await checkDailyLimit(
  user.id,
  `notebook:ai-assist:${threadId}`,
  10 * 60
);
if (!rateCheck.allowed) {
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
}
```

- Cache where applicable to reduce spend:

```101:108:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/ai-assist/route.ts
const wordsKey = selectedWords.map((w) => w.text).join("_");
const cacheKey = `ai-assist:${threadId}:${cellId}:${wordsKey}:${instruction || "refine"}`;
const cached = await cacheGet<AIAssistResponse>(cacheKey);
if (cached) return NextResponse.json(cached);
```
