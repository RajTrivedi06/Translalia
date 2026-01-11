### [Last Updated: 2025-11-04]

## Business Logic

### Core domain models and entities

- Projects: own threads and versions

```18:27:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/projects/route.ts
const { data, error } = await sb
  .from("projects")
  .insert({ title: safeTitle.slice(0, 120), owner_id: guard.user.id, src_lang: parsed.data.src_lang ?? null, tgt_langs: parsed.data.tgt_langs ?? null })
  .select("id, title, created_at")
  .single();
```

- Chat Threads: hold conversation and `state` JSONB (guide answers, notebook, analysis)

```70:99:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/cells/route.ts
const { data: thread } = await supabase.from("chat_threads").select("id,created_by,state").eq("id", params.threadId).single();
const state = (thread.state as any) || {};
const poemAnalysis = state.poem_analysis || {};
const workshopLines = state.workshop_lines || {};
const notebookCells = state.notebook_cells || {};
```

- Versions: translation outputs per project with lineage in `meta`

```33:38:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/versions/nodes/route.ts
.from("versions").select("id, tags, meta, created_at").eq("project_id", th.project_id)
```

- Compares: pairwise comparison between versions

```31:40:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/compares/route.ts
.insert({ project_id: projectId, left_version_id: leftId, right_version_id: rightId, lens, granularity, notes: notes ?? null })
```

- Journey Items: activity log entries for projects

```49:55:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/compares/route.ts
await guard.sb.from("journey_items").insert({ project_id: projectId, kind: "compare", summary: `Compared ${leftId} vs ${rightId} (${lens}/${granularity})`, compare_id: c.id });
```

### Business rules and invariants

- Ownership: users may only read/write their own `projects`, `chat_threads`, and derived data

```31:35:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/threads/list/route.ts
if (proj.owner_id !== user.id) { return NextResponse.json({ ok: false, code: "FORBIDDEN_PROJECT" }, { status: 403 }); }
```

- Thread access: 401 on unauthenticated, 403 on foreign, 404 when missing

```82:85:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/cells/route.ts
if (thread.created_by !== user.id) { return err(403, "FORBIDDEN", "You do not have access to this thread."); }
```

- Version lineage: `parent_version_id` links A→B→C→D in `versions.meta`

```151:161:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/components/workspace/versions/VersionCanvas.tsx
const lineage: Edge[] = (apiNodes || []).filter((n) => !!n.parent_version_id).map((n) => ({ id: `lineage:${String(n.parent_version_id)}->${n.id}`, source: String(n.parent_version_id), target: n.id }));
```

- Anti-echo policy: enforce non-echo output; retry once, then 409

```294:306:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/translator/preview/route.ts
if (!forceTranslate && (echoish || untranslated)) { /* retry path; else PREVIEW_ECHOED_SOURCE 409 */ }
```

### Validation logic

- Input validation with Zod schemas for creates and updates

```3:7:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/schemas.ts
export const createProjectSchema = z.object({ title: z.string().trim().max(120).optional(), src_lang: z.string().trim().max(32).optional(), tgt_langs: z.array(z.string()).optional(), });
```

```21:28:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/schemas.ts
export const createVersionSchema = z.object({ projectId: z.string().uuid(), title: z.string().trim().min(1).max(120), lines: z.array(z.string()).min(1), tags: z.array(z.string()).optional(), meta: z.record(z.string(), z.any()).optional(), summary: z.string().optional(), });
```

- Guide state updates validate partial structures and merge

```46:56:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/server/guide/updateGuideState.ts
const GuideAnswersSchema = z.object({ translationIntent: z.string().nullable().optional(), /* … */ }).passthrough();
```

```116:125:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/server/guide/updateGuideState.ts
await supabase.from("chat_threads").update({ state: { ...currentState, guide_answers: mergedAnswers } }).eq("id", threadId);
```

- Compare constraints

```24:28:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/compares/route.ts
if (leftId === rightId) { return NextResponse.json({ error: "leftId and rightId must be different" }, { status: 400 }); }
```

### Workflow processes

- Core flow: Interview (collect guide answers) → Generate/Preview translation → Accept lines → Persist version and update nodes → Notebook editing/locks → Export

```33:76:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/locks/route.ts
// parse body, auth, fetch thread, verify ownership, check lock status, update state.notebook_cells[line], persist
```

- Journey and reflection: generate reflective summary of progress for the project

```96:137:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/journey/generate-reflection/route.ts
// build reflection prompt from progress and guide answers; call OpenAI; return JSON
```

### Business calculations and algorithms

- Display label allocation per thread

```4:21:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/server/labels/displayLabel.ts
const currentIndex = Number.isFinite((state as any).last_display_label_index) ? (state as any).last_display_label_index : -1;
const nextIndex = currentIndex + 1;
const displayLabel = indexToDisplayLabel(nextIndex);
```

- Label encoding/decoding A, B, ..., Z, AA, AB …

```1:14:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/lib/labels.ts
export function indexToAlpha(n: number): string { /* base 26 alphabet */ }
export function indexToDisplayLabel(n: number): string { return `Version ${indexToAlpha(n)}`; }
```

- Notebook cell derivation from workshop and analysis

```95:141:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/cells/route.ts
const translatedText = workshopLine?.translated || workshopLine?.text || "";
let status: NotebookCell["translation"]["status"] = "untranslated";
if (cellData.translation?.status) { status = cellData.translation.status; } else if (translatedText) { status = "draft"; }
```

### Domain events and handlers

- Journey items appended on compare creation

```49:55:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/compares/route.ts
await guard.sb.from("journey_items").insert({ kind: "compare", /* ... */ });
```

- Ledger updates on accept-lines (append to thread state)

```66:68:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/translator/accept-lines/route.ts
await appendLedger(threadId, { ts: new Date().toISOString(), kind: "accept", note: `Accepted ${selections.length} line(s)` });
```

### Use cases and implementations

- Create project

```5:15:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/projects/route.ts
const parsed = createProjectSchema.safeParse(await req.json());
if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
```

- List threads for project (ownership required)

```8:15:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/threads/list/route.ts
const projectId = new URL(req.url).searchParams.get("projectId");
if (!projectId) return NextResponse.json({ ok: false, code: "MISSING_PROJECT_ID" }, { status: 400 });
```

- Generate prismatic variants for a line (Notebook)

```30:68:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/prismatic/route.ts
// parse BodySchema, auth via SSR cookies, check thread ownership, build prompts, call OpenAI, return variants
```

- Get notebook cells view for thread

```24:33:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/notebook/cells/route.ts
/** GET /api/notebook/cells?threadId=xxx */
```

- Create compare between versions

```5:13:/Users/raaj/Documents/CS/metamorphs/translalia-web/src/app/api/compares/route.ts
/** POST /api/compares */
```

### Validation & invariants summary (JSON)

```json
{
  "ownership": ["project.owner_id == user.id", "thread.created_by == user.id"],
  "versions": {
    "meta.parent_version_id": "nullable string",
    "display_label": "Version [A-Z]+"
  },
  "compare": { "leftId != rightId": true },
  "guide": { "answers": "partial schema allowed" },
  "notebook": { "translation.status": "untranslated|draft|locked" }
}
```
