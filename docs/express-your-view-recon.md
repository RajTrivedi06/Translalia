# Express Your View — Reconnaissance

Investigation only. No source files were modified. Findings cite current code as evidence.

**Feature context (not built yet):** After translation and the AI journey summary, the student writes a free-text critical reflection (“Express Your View”), clicks **Finish**, and the diary/export document opens with a dedicated **Student Reflection** section alongside translation and journey summary.

---

## 1. Existing reflection / free-text fields

### 1.1 `threadNote` / “General Reflection”

| Aspect | Evidence |
|--------|----------|
| **Zustand store field** | `threadNote: string \| null` in `notebookSlice.ts` |
| **Store actions** | `setThreadNote`, `setNotes(threadNote, lineNotes)` |
| **Not persisted to localStorage** | `partialize` only saves `meta`, `showLineNumbers`, `fontSize`, `lastEditedLine` — not `threadNote` |

```35:37:translalia-web/src/store/notebookSlice.ts
  threadNote: string | null;
  lineNotes: Record<number, string>;
  noteEditingLineIndex: number | null;
```

```212:217:translalia-web/src/store/notebookSlice.ts
      partialize: (state) => ({
        meta: state.meta,
        showLineNumbers: state.showLineNumbers,
        fontSize: state.fontSize,
        lastEditedLine: state.lastEditedLine,
      }),
```

| **DB path** | `chat_threads.state.notebook_notes.thread_note` |
| **GET/POST API** | `/api/notebook/notes` |
| **Atomic write** | `patchThreadStateField(threadId, ["notebook_notes"], updatedNotes)` |

```82:96:translalia-web/src/app/api/notebook/notes/route.ts
    const notebookNotes = state.notebook_notes || {
      thread_note: null,
      line_notes: {},
      updated_at: null,
    };
    // ...
    return ok({
      threadNote: notebookNotes.thread_note || null,
      lineNotes: notebookNotes.line_notes || {},
      updatedAt: notebookNotes.updated_at || null,
    });
```

| **Hydration (API → Zustand, once per thread)** | `useNotebookNotesHydration` mounted from `NotebookPhase6.tsx` |

```22:26:translalia-web/src/lib/hooks/useNotebookNotesHydration.ts
  React.useEffect(() => {
    if (notesData && isInitialLoad) {
      setNotes(notesData.threadNote, notesData.lineNotes);
      setIsInitialLoad(false);
    }
```

| **Where edited in UI today** | **`NotesSheet.tsx`** — top section labeled “General Reflection”, using `ThreadNotesEditor` + debounced save |

```134:173:translalia-web/src/components/notebook/NotesSheet.tsx
              {/* General Reflection */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("notesThreadTitle", {
                      defaultValue: "General Reflection",
                    })}
                  </h3>
                  // ...
                </div>
                <ThreadNotesEditor
                  value={threadNote}
                  onChange={handleThreadNoteChange}
                  maxLength={5000}
                />
              </section>
```

**Note:** `NotebookNotesPanel` no longer exists in the codebase. The notes rework (see §7) already moved General Reflection into `NotesSheet` (confirmed by `docs/agent-temp/notes-rework-recon.md` and absence of `NotebookNotesPanel*` files).

| **Save path** | `useDebouncedNotesSave` → `useSaveNotebookNotes` → `POST /api/notebook/notes` with `{ threadNote }` only |

```9:11:translalia-web/src/lib/hooks/useDebouncedNotesSave.ts
/**
 * Debounced bulk save for the thread note (General Reflection) in NotesSheet.
 */
```

| **Placeholder copy** | `Notebook.notesThreadPlaceholder`: *“Write your reflections about the translation journey…”* |

| **Shown in diary?** | Yes — under expandable **Notes** section, renders `entry.notebook_notes.thread_note` (no sub-heading; diary key `Diary.threadNote` exists but is unused in render) |

```276:290:translalia-web/src/app/[locale]/(app)/diary/page.tsx
            {hasNotes && (
              <ExpandableSection
                title={t("notes")}
                icon={StickyNote}
                defaultOpen={false}
              >
                {entry.notebook_notes?.thread_note && (
                  <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-border-subtle/60">
                    <p className="font-serif text-base leading-relaxed text-foreground-secondary">
                      {entry.notebook_notes.thread_note}
                    </p>
                  </div>
                )}
              </ExpandableSection>
            )}
```

| **Feeds AI prompts?** | Yes — via `formatNotebookNotesForPrompt` |

```1425:1428:translalia-web/src/lib/ai/workshopPrompts.ts
  // General reflection
  if (notes.thread_note && notes.thread_note.trim()) {
    sections.push(`GENERAL REFLECTION:\n"${notes.thread_note}"`);
  }
```

**Consumers of `formatNotebookNotesForPrompt`:**
- `POST /api/journey/generate-reflection` (lines 178–182)
- `buildAIAssistStepCPrompt` in `workshopPrompts.ts` (lines 1533–1537), used by `POST /api/reflection/ai-assist-step-c`

| **Read in ReflectionRail (not edited there)** | Used for “Notes included” badge and passed read-only to `NotebookAISuggestions` |

```75:77:translalia-web/src/components/reflection-rail/ReflectionRail.tsx
  const hasNotes =
    !!threadNote ||
    Object.keys(lineNotes).filter((k) => lineNotes[parseInt(k)]).length > 0;
```

```229:231:translalia-web/src/components/reflection-rail/ReflectionRail.tsx
                  <NotebookAISuggestions
                    translationDiary={notebookNotes?.threadNote || undefined}
                    lineNotes={notebookNotes?.lineNotes}
```

---

### 1.2 Line notes (`lineNotes`)

| Aspect | Evidence |
|--------|----------|
| **Store** | `lineNotes: Record<number, string>` in `notebookSlice.ts` |
| **DB** | `chat_threads.state.notebook_notes.line_notes` |
| **API** | `POST /api/notebook/notes/line` (per-line atomic patch) |
| **UI** | `LineNotePopover` on notebook rows; list/edit/delete in `NotesSheet` |
| **Diary** | Inline under each translated line (not in the Notes expandable block) |
| **AI prompts** | Included in `formatNotebookNotesForPrompt` as `LINE-SPECIFIC NOTES` |

---

### 1.3 Reflection rail (`ReflectionRail.tsx`)

The right-hand “EDITING” panel (`Thread.reflection` i18n key) hosts **`ReflectionRail`**. It contains **no student-authored free-text field**. All interactive outputs are AI-generated or workshop actions.

| Block | Student writes? | Mechanism |
|-------|-----------------|-----------|
| **Refine & Rhyme** | No | Embeds `NotebookAISuggestions` (AI rhyme/refinement suggestions; applies text to drafts) |
| **Translation Insights** (“step-c”) | No | Button → `POST /api/reflection/ai-assist-step-c` → displays AI `aims` + `suggestions[]` |
| **Journey Summary** | No | Button → `POST /api/journey/generate-reflection` → displays AI `insights`, `strengths`, `challenges`, `recommendations`, optional `reflection` narrative |
| **Finish** | No (button only) | Opens `CongratulationsModal` |

Step-c route reads `notebook_notes` (including `thread_note`) from thread state but does not expose a textarea:

```125:136:translalia-web/src/app/api/reflection/ai-assist-step-c/route.ts
    const notebookNotes = state.notebook_notes || {
      thread_note: null,
      line_notes: {},
      updated_at: null,
    };
    log("context_extracted", {
      poemLinesCount: poemLines.length,
      completedLinesCount: Object.keys(completedLines).length,
      hasThreadNote: !!notebookNotes.thread_note,
```

There is **no** “step-c” student write-back field in the UI today.

---

### 1.4 Orphan backend: `journey_reflections.student_reflection`

A **separate** student-reflection persistence path exists but has **zero UI callers** (grep across `translalia-web/src` finds only API route files).

```107:118:translalia-web/src/app/api/journey/save-reflection/route.ts
    const { data: reflection, error: dbErr } = await supabase
      .from("journey_reflections")
      .insert({
        project_id: body.projectId,
        thread_id: body.threadId,
        student_reflection: body.studentReflection,
        completed_lines_count: body.completedLinesCount,
        total_lines_count: body.totalLinesCount,
        status: "reflection_only",
        created_by: user.id,
      })
```

Companion route `POST /api/journey/generate-brief-feedback` accepts `studentReflection` and generates AI brief feedback, updating `journey_reflections`. Also **no UI usage**.

Documented in `docs/02-reference/database.md` and `specs/openapi.yaml` (`/api/journey/save-reflection`, `/api/journey/generate-brief-feedback`). **Not** joined by `diary_completed_poems` RPC.

---

### 1.5 Other student free-text in the workflow

| Location | Field | Persisted | Diary | AI prompts |
|----------|-------|-----------|-------|------------|
| **Guide rail** — poem paste/upload | `raw_poem` | Thread column + state | Full poem section | Translation pipeline |
| **Guide rail** — Translation Zone | `translation_zone` | Thread column | No dedicated section | Journey + step-c prompts |
| **Guide rail** — Translation Intent | `translation_intent` | Thread column | No | Journey + step-c prompts |
| **Guide rail** — Source language variety | `source_language_variety` | Thread column | No | Translation |
| **Notebook** — translation line textareas | `draftLines` / `workshop_lines` | `chat_threads.state.workshop_lines` | Translation section | Indirectly |

Guide textareas (examples):

```1100:1121:translalia-web/src/components/guide/GuideRail.tsx
            <textarea
              id="translation-zone-input"
              rows={4}
              value={translationZoneText}
              onChange={(e) => {
                const val = e.target.value;
                setTranslationZone(val);
```

These are **setup/brief** fields, not post-translation reflection.

---

### §1 Conclusion

**“Express Your View” is not the same as today’s General Reflection (`threadNote`) in behavior or placement**, though copy overlaps (“reflections about the translation journey”).

| | General Reflection (`threadNote`) | Express Your View (client spec) |
|--|-----------------------------------|----------------------------------|
| **When** | Anytime during translation (Notes sheet) | After journey summary, end of workflow |
| **Purpose** | Ongoing translation diary / process notes | Critical reflection on AI suggestions, difficulty, AI errors |
| **Storage** | `state.notebook_notes.thread_note` | **No wired UI field**; closest match is orphan `journey_reflections.student_reflection` |
| **Diary section** | “Notes” (shared with line notes) | Dedicated “Student Reflection” / “Express Your View” |

**Recommendation preview:** Treat Express Your View as a **distinct field**, ideally wiring the existing `journey_reflections` + `save-reflection` API rather than reusing `threadNote`. Reusing `threadNote` would be a **relocate + reframe**, not a zero-change alias, and would collide with the notes rework (§7).

---

## 2. Journey summary

### Generation

| Item | Location |
|------|----------|
| **API** | `POST /api/journey/generate-reflection` — `translalia-web/src/app/api/journey/generate-reflection/route.ts` |
| **Caller** | `ReflectionRail.handleGetJourneyReflection` |

```140:175:translalia-web/src/components/reflection-rail/ReflectionRail.tsx
  const handleGetJourneyReflection = async () => {
    // ...
      const response = await fetch("/api/journey/generate-reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          context: {
            poemLines,
            completedLines,
            // ...
          },
        }),
      });
      // ...
      setJourneyReflection(data.reflection);
```

### Persistence

On success, the route inserts into **`journey_ai_summaries`** (not `journey_reflections`):

```385:404:translalia-web/src/app/api/journey/generate-reflection/route.ts
    // Persist reflection to journey_ai_summaries
    try {
      const { error: persistError } = await supabase
        .from("journey_ai_summaries")
        .insert({
          project_id: thread.project_id,
          thread_id: body.threadId,
          // ...
          reflection_text: reflection.reflection ?? null,
          insights: reflection.insights ?? [],
          strengths: reflection.strengths ?? [],
          challenges: reflection.challenges ?? [],
          recommendations: reflection.recommendations ?? [],
```

### Display in UI

Rendered in **`ReflectionRail`** inside the collapsible **“Journey Summary”** card. Stored in **local React state** (`journeyReflection`); **not re-fetched** from DB on page load (state resets on thread switch, line 80–98).

### When the student sees it

- Reflection panel is the **4th column** in working mode (`ThreadPageClient` grid: Guide | Workshop | Notebook | Reflection).
- On workshop start, reflection panel starts **collapsed** (`setIsReflectionCollapsed(true)` in `onAutoCollapse`).
- Journey summary is **opt-in**: student must expand the card and click **“Generate Journey Summary”**.
- **No gate** ties journey summary to Finish.

### Input data (includes notes)

The route loads `state.notebook_notes` from DB and passes it through `formatNotebookNotesForPrompt`:

```136:182:translalia-web/src/app/api/journey/generate-reflection/route.ts
    const notebookNotes = state.notebook_notes || {
      thread_note: null,
      line_notes: {},
      updated_at: null,
    };
    // ...
    const notesSection = formatNotebookNotesForPrompt(
      notebookNotes,
      context.poemLines,
      completedLinesRecord
    );
```

Prompt instruction explicitly references student notes:

```200:200:translalia-web/src/app/api/journey/generate-reflection/route.ts
Please provide a reflective journey summary focusing on the translator's process, growth, and decisions (NOT a quality comparison of source vs translation). If the student has written notes, pay special attention to their reflections and incorporate their thinking process into the summary.`;
```

**Important timing note:** Because journey summary is generated **before** any post-summary Express Your View step, **`threadNote` content written only after generation would not influence that run** unless the student regenerates.

---

## 3. Completion / “Finish” flow

### Finish button

Located at the bottom of `ReflectionRail`, shown when `allLinesCompleted`:

```530:556:translalia-web/src/components/reflection-rail/ReflectionRail.tsx
          {allLinesCompleted && (
            <Card className="p-4 border-card-green-border bg-card-green-bg/30">
              // ...
                <Button
                  onClick={() => setShowCongratulations(true)}
                  className="w-full"
                  variant="default"
                  size="lg"
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  {t("finish")}
                </Button>
```

i18n copy (`Thread` namespace):

```122:124:translalia-web/messages/en.json
    "translationComplete": "Translation Complete",
    "translationCompleteDescription": "All {count} lines have been translated. Click Finish to complete your translation journey.",
    "finish": "Finish",
```

### What Finish does today

1. Sets `showCongratulations` → opens **`CongratulationsModal`**
2. Modal primary action is **“Continue to Review”** which calls `onClose` — **closes the modal only**

```402:419:translalia-web/src/components/workshop/CongratulationsModal.tsx
              <Button
                onClick={onClose}
                size="lg"
                // ...
              >
                <span className="relative">Continue to Review</span>
              </Button>
```

**No API call, no state mutation, no navigation on Finish.**

Searched for `completed_at`, `markComplete`, journey finish routes — **not found** for thread completion. “Complete” in the diary sense is **derived**, not explicitly marked.

### What marks a thread “completed” for the diary

`diary_completed_poems` RPC: all `workshop_lines` array elements must have non-empty `translated`:

```78:85:translalia-web/supabase/migrations/20260121_diary_completed_poems.sql
    -- completion: no nulls + every element has translated
    and not exists (
      select 1
      from jsonb_array_elements(ct.state->'workshop_lines') as e
      where
        e = 'null'::jsonb
        or coalesce(nullif(e->>'translated',''), '') = ''
    )
```

Completion can occur **without** ever clicking Finish, generating a journey summary, or writing any reflection.

### What opens the diary after finishing

**Nothing automatic.** Diary is a separate nav destination (`AuthNav` → `/diary`). No `router.push("/diary")` from Finish or `CongratulationsModal` (grep confirms only auth redirect and nav link).

### Current end-of-workflow order (actual)

```
Guide setup (poem, zone, intent)
    ↓
Workshop + Notebook (translate all lines) — parallel panels
    ↓
[Optional, any time ≥1 line done] Reflection rail:
    Refine & Rhyme | Translation Insights (step-c) | Journey Summary (each opt-in)
    ↓
[When all lines translated] Finish card visible
    ↓
Click Finish → CongratulationsModal → "Continue to Review" → stay on thread page
    ↓
[Separate user action] Navigate to /diary via nav (if workshop_lines complete)
```

**Gap vs client spec:** No mandated sequence of journey summary → student reflection → Finish → diary opens.

---

## 4. Diary / exported document assembly

### Route and data

| Layer | Path |
|-------|------|
| **Page** | `translalia-web/src/app/[locale]/(app)/diary/page.tsx` |
| **API** | `GET /api/diary/completed-poems` |
| **RPC** | `diary_completed_poems` (`20260121_diary_completed_poems.sql`) |

RPC returns per completed thread:

```24:36:translalia-web/supabase/migrations/20260121_diary_completed_poems.sql
returns table (
  thread_id uuid,
  title text,
  thread_created_at timestamptz,
  raw_poem text,
  workshop_lines jsonb,
  notebook_notes jsonb,
  journey_summary_created_at timestamptz,
  reflection_text text,
  insights text[],
  strengths text[],
  challenges text[],
  recommendations text[]
)
```

(`reflection_text` here is **AI narrative** from `journey_ai_summaries`, not student text.)

### Sections rendered today (`PoemEntry`)

1. **Header** — title, date, line count, “Journey reviewed” badge if `journey_summary_created_at`
2. **Translation** — side-by-side original/translated; line notes inline per row
3. **Notes** (expandable, if `thread_note` or line notes exist) — shows **`thread_note` only** inside expandable (line notes already shown above)
4. **Journey Summary** (expandable, if AI summary exists) — AI `reflection_text`, insights, strengths, challenges, recommendations
5. **Original Text (Full)** (expandable, if `raw_poem`)

**No “Student Reflection” / “Express Your View” section exists.**

### Where to add Student Reflection

Natural insertion: **after Journey Summary, before Full Original** in `PoemEntry` (`diary/page.tsx` ~395), mirroring client doc order.

**Data source gap:** `diary_completed_poems` does **not** expose `journey_reflections.student_reflection` or any `state` field for Express Your View. Would require RPC migration + API type update + UI section.

### Export / download

| Feature | Exists? | Evidence |
|---------|---------|----------|
| **Diary page export** | **No** | No export/print handlers in `diary/page.tsx` |
| **Comparison view TXT export** | **Yes** | `ComparisonView.tsx` — blob download `comparison-{timestamp}.txt` |
| **Comparison view print/PDF** | **Yes** | Opens print window with `window.print()` button |
| **i18n keys for export** | Present under `Comparison` namespace | `exportAsTxt`, `printOrSaveAsPdf` in `en.json` — used by ComparisonView, not diary |

**“The document” today = on-screen diary cards**, not a unified export artifact. Comparison export covers translation pairs only (no notes, journey summary, or reflection).

---

## 5. Persistence options

### Option A — Reuse `notebook_notes.thread_note`

| Pro | Con |
|-----|-----|
| GET/POST `/api/notebook/notes` already round-trips | Semantically wrong: mid-workflow “General Reflection” vs post-AI critical review |
| Already in diary “Notes” section | Would **not** get a distinct “Express Your View” section without relabeling/splitting |
| Already in AI prompts | Content written **after** journey summary wouldn’t affect **already-generated** summary |
| Near-zero backend if reframed | **Collides with notes rework** (§7) |

### Option B — Wire existing `journey_reflections.student_reflection` (recommended backend path)

| Item | Status |
|------|--------|
| Table | Referenced in code + `docs/02-reference/database.md`; **DDL not in repo migrations** |
| API | `POST /api/journey/save-reflection` — validated body, ownership checks, insert |
| OpenAPI | Documented in `specs/openapi.yaml` |
| UI | **None** |
| Diary RPC | **Not joined** |

Finish handler would call this API (needs `projectId` from route params — available in `ThreadPageClient`).

### Option C — New field under `chat_threads.state`

Example: `state.express_your_view` or `state.student_reflection`.

Pattern to match (same as notes):

```177:180:translalia-web/src/app/api/notebook/notes/route.ts
    const patchResult = await patchThreadStateField(
      body.threadId,
      ["notebook_notes"],
      updatedNotes
    );
```

Would need a thin `GET/POST /api/journey/express-your-view` (or similar) route using `patchThreadStateField(threadId, ["express_your_view"], value)` plus diary RPC change to select `ct.state->'express_your_view'`.

Alternatively extend `notebook_notes`:

```json
{
  "thread_note": "...",
  "line_notes": {},
  "express_your_view": "...",
  "updated_at": "..."
}
```

Keeps one notes blob but requires schema/doc updates and diary RPC already reads `notebook_notes` jsonb wholesale (could surface new key without RPC change if UI reads nested field).

### GET/POST pattern reference

Existing state-field features use:
1. `requireUser()` + thread ownership check
2. Read current state from `chat_threads`
3. Merge + `patchThreadStateField`
4. Return camelCase JSON to client

See `/api/notebook/notes` (GET query `threadId`, POST body with `threadId` + fields).

---

## 6. Reflection rail vs Notebook vs new step — placement

### Option (a) New step in ReflectionRail after Journey Summary — **best fit**

| Factor | Assessment |
|--------|------------|
| **Flow alignment** | Journey Summary card already lives here; Finish card is already last |
| **Component cost** | Add one Card + textarea + save hook; reorder/gate Finish |
| **Existing patterns** | `ThreadNotesEditor` reusable; or call `save-reflection` API |
| **Finish + diary** | Extend Finish handler in same file |

Insert between Journey Summary block (~line 528) and Finish card (~line 530) in `ReflectionRail.tsx`.

### Option (b) New panel/section in ThreadPageClient

Would require a 5th workflow phase or modal overlay outside the 4-column grid. Higher cost; breaks current “all post-translation tools in Reflection rail” layout.

### Option (c) Part of existing Notebook / NotesSheet

General Reflection already occupies top of NotesSheet. Adding Express Your View there conflates two reflection types in one sheet and misses “after journey summary” ordering unless heavily gated/hidden — awkward UX.

### Option (d) Wire orphan `save-reflection` on Finish only

Minimal UI: modal step or inline form triggered by Finish instead of immediate congratulations. Pairs naturally with diary navigation after save.

---

## 7. Collision check with Notes rework

### Notes rework state (from `docs/agent-temp/notes-rework-recon.md`)

- Replaced always-visible `NotebookNotesPanel` with per-line popover + **`NotesSheet`**
- **General Reflection (`threadNote`) moved to top of NotesSheet**
- Per-line writes should use `/api/notebook/notes/line`

**Current code confirms:** `NotesSheet` is the sole editor for `threadNote`; `NotebookNotesPanel` is gone.

### Same data or distinct?

| Interpretation | Implication |
|----------------|-------------|
| **Same as `threadNote`** | Two UIs (NotesSheet anytime + Express Your View at end) edit one field → **ownership conflict**; diary shows once under “Notes”, not as dedicated section; relabeling required |
| **Distinct field** (matches client spec) | General Reflection = in-process diary; Express Your View = post-AI meta-reflection → **no data collision**; need separate persistence + diary section |

**Client spec language** (critical reflection on AI suggestions, difficulty, AI errors) aligns with **distinct** field, closer to orphan `student_reflection` than ongoing `threadNote`.

### If same field — options

1. **Single field, two surfaces** — NotesSheet + end step both bind `threadNote`; diary one section; confusing if student wrote different content at different times (last write wins).
2. **Repurpose `threadNote` for Express Your View only** — remove/rename General Reflection in NotesSheet; breaks notes rework intent for in-process diary.
3. **Keep both** — `threadNote` in NotesSheet + new `student_reflection` for Express Your View (**recommended**).

### Files both features touch if reusing `threadNote`

| File | Notes rework | Express Your View (if reusing `threadNote`) |
|------|--------------|---------------------------------------------|
| `notebookSlice.ts` | ✓ | ✓ |
| `NotesSheet.tsx` | ✓ | Maybe hide/relabel |
| `useDebouncedNotesSave.ts` | ✓ | ✓ |
| `/api/notebook/notes/route.ts` | ✓ | ✓ |
| `diary/page.tsx` | ✓ (Notes section) | ✓ (same section) |
| `messages/*.json` (`Notebook`, `Diary`) | ✓ | ✓ |
| `ReflectionRail.tsx` | — | ✓ (new editor) |
| `formatNotebookNotesForPrompt` / AI routes | ✓ | ✓ |

If using **`journey_reflections`** instead, overlap with notes rework is **minimal** (`ReflectionRail.tsx`, diary RPC, diary page, new hook, i18n).

---

## 8. i18n & locales

### Locale files (9 total)

`translalia-web/messages/`:
- `en.json` (source)
- `ar.json`, `es.json`, `es-AR.json`, `hi.json`, `ml.json`, `ta.json`, `te.json`, `zh.json`

### Namespace pattern

| Area | Namespace | Example keys |
|------|-----------|--------------|
| Reflection rail / Finish | `Thread` | `finish`, `translationComplete`, `reflection` |
| Notebook notes | `Notebook` | `notesThreadTitle`, `notesThreadPlaceholder` |
| Diary page | `Diary` | `journeySummary`, `threadNote`, `notes` |

Usage: `const t = useTranslations("Thread")` etc.

### Suggested keys for Express Your View

- **`Thread`**: step title, placeholder, validation, “Save & Finish” (workflow UI in ReflectionRail)
- **`Diary`**: section title `expressYourView` or `studentReflection` (distinct from `threadNote` / `notes`)

Per repo convention, add to `en.json` first, mirror English into other 8 files until translated.

Existing related string (unused for dedicated section):

```338:338:translalia-web/messages/en.json
    "threadNote": "General Reflection",
```

---

## Recommendation & open questions

### 1. New field or reuse `threadNote`?

**Use a distinct field.** Reusing `threadNote` conflicts with the notes rework (General Reflection in NotesSheet), blurs in-process notes vs post-AI critique, and cannot produce a separate diary section without awkward relabeling.

**Strongest existing backend:** wire UI to **`POST /api/journey/save-reflection`** → `journey_reflections.student_reflection` (orphan but spec’d). Alternative: `patchThreadStateField` on `state.express_your_view` if team prefers single JSON blob over a dedicated table.

**Do not conflate with AI `journey_ai_summaries.reflection_text`** — that is model-generated journey narrative.

### 2. Where the step renders and finish order

**Render in ReflectionRail:** new card after **Journey Summary**, before **Finish**.

**Proposed order:**

```
All lines translated
  → (encouraged/required?) Generate Journey Summary
  → Express Your View textarea (student)
  → Finish → save student reflection → navigate to /diary?thread=… or /diary
```

Replace or extend `CongratulationsModal` to perform save + navigation.

### 3. Real export document?

**No unified export for the diary artifact.** Only on-screen `/diary` cards plus separate ComparisonView TXT/print (translation-only). Delivering “exported document” in v1 likely means **diary view + optional print stylesheet**, not a new PDF pipeline.

### 4. Smallest safe change set

1. **`ReflectionRail.tsx`** — Express Your View card + gate Finish on non-empty reflection (product decision on required vs optional).
2. **Wire `POST /api/journey/save-reflection`** on Finish (or debounced save while typing) — verify `journey_reflections` table exists in deployed Supabase (DDL gap in repo).
3. **`diary_completed_poems` RPC + migration** — join latest `journey_reflections.student_reflection` per thread.
4. **`diary/page.tsx`** — new expandable “Express Your View” / “Student Reflection” section.
5. **`messages/en.json` + 8 mirrors** — `Thread.*` and `Diary.*` keys.
6. **Finish navigation** — `router.push("/diary")` (or deep link to entry) after successful save.

**Explicitly out of smallest path (unless requested):** `generate-brief-feedback` AI response, diary PDF export, reusing `threadNote`, regenerating journey summary after student reflection.

### Open questions (not resolved from code)

1. **`journey_reflections` DDL** — table referenced but no migration in repo; confirm production schema before wiring UI.
2. **Required vs optional** — Is journey summary mandatory before Express Your View? Currently optional. Is reflection text mandatory to Finish?
3. **`generate-brief-feedback`** — Should Finish trigger AI brief feedback on student text (backend exists, UI does not)?
4. **Diary entry point after Finish** — Open full diary list, scroll to thread, or new single-session export view?
5. **Regenerate journey summary** — Should post-reflection summary incorporate Express Your View (would need prompt/API change)?
6. **Relationship to General Reflection** — Keep both fields with clear copy differentiation, or deprecate General Reflection for students who only use end reflection?
7. **Panel naming** — UI label is “EDITING” (`Thread.reflection`) but content is reflection/AI tools; may confuse students when adding “Express Your View”.

### Contradictions: client prompt vs code

| Client assumption | Code reality |
|-----------------|--------------|
| Finish opens diary/export | Finish only opens modal; no diary navigation |
| Step comes after journey summary | Journey summary is opt-in; Finish available without it |
| Student reflection in final document | `threadNote` appears under “Notes”; no dedicated section; `student_reflection` not in diary RPC |
| May be same as General Reflection | Distinct orphan field `student_reflection` exists; different storage and lifecycle |

**Trust the code** for current behavior; use orphan `save-reflection` infrastructure as the likely extension point for a **distinct** Express Your View field.
