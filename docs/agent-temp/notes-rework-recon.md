# Notes/Nodes Rework — Reconnaissance

Investigation only. No source files were modified. All findings cite current code as evidence.

Scope: feasibility + ground-truth for replacing the always-visible `NotebookNotesPanel` with a contextual per-line note affordance (hover/right-click popover + right-edge marker) and a "Notes" Sheet listing all notes.

---

## 1. Row structure (`NotebookPhase6.tsx`)

### How rows are generated and mapped to line indices

Rows are produced by a single `Array.from({ length: totalLines }, (_, idx) => …)` map. The loop index `idx` **is** the 0-based line index used everywhere (workshop store, notes, save). `totalLines = max(sourceLineCount, maxCompletedIndex + 1)` so extra lines beyond the source poem are also rendered.

```tsx
// NotebookPhase6.tsx (~414)
{Array.from({ length: totalLines }, (_, idx) => {
  const isActive = idx === currentLineIndex;
  const draft = draftLines[idx];
  const completed = completedLines[idx];
  const text = draft ?? completed ?? "";
  const status = completed && !draft ? "completed" : draft ? "draft" : "empty";
  const hasContent = text.trim().length > 0;
  const isHovered = hoveredLineIndex === idx;
  const isExtraLine = idx >= sourceLineCount;
  const sourceLine = poemLines[idx] ?? "";
  return ( /* row */ );
})}
```

### The element representing "one line"

Each line is **one `motion.div`** keyed `row-${idx}`. It is a 2-column grid and — importantly — `relative`:

```tsx
// NotebookPhase6.tsx (~427)
<motion.div
  key={`row-${idx}`}
  initial={false}
  animate={{ backgroundColor: isActive ? "rgb(239 246 255 / 0.5)" : isHovered ? "rgb(250 248 244)" : "transparent" }}
  transition={{ duration: 0.15 }}
  className={[
    "notebook-row grid grid-cols-2 border-b border-border-subtle relative",
    isActive ? "notebook-row-selected" : "",
    isExtraLine ? "bg-purple-50/20" : "",
  ].join(" ")}
  onMouseEnter={() => setHoveredLineIndex(idx)}
  onMouseLeave={() => setHoveredLineIndex(null)}
>
```

- **Source cell** = a `<button>` (left column).
- **Translation cell** = a `<div className="group relative px-3 py-3 flex items-start gap-2">` (right column) containing a status icon, the drop zone + `<Textarea>` (`flex-1 min-w-0`), and a trailing pencil/clear control.

```tsx
// NotebookPhase6.tsx (~478) — translation cell
<div className="group relative px-3 py-3 flex items-start gap-2" onClick={() => setCurrentLineIndex(idx)}>
  <NotebookStatusIndicator status={status === "empty" ? "pending" : status} size="md" className="mt-1.5 ml-0.5" />
  <div className="flex-1 min-w-0">
    <NotebookDropZone …>
      <Textarea … className="… flex-1-equivalent (w-full) …" />
    </NotebookDropZone>
  </div>
  {/* trailing pencil (empty+hover) / clear button (content+hover/active) */}
</div>
```

### Where a fixed-width right-edge slot can live without reflowing text

**Cleanly feasible — no contradiction with Shared Context.** Two viable anchors:

1. **Preferred: absolutely-positioned marker on the row.** `.notebook-row` is already `relative` (see snippet above and CSS in §3). A marker placed `absolute right-0 top-0` (or a small fixed-width box at the right edge) does not participate in flow and therefore cannot shrink the `flex-1 min-w-0` textarea. This is the lowest-risk option.
2. **Alternative: a fixed-width flex child appended to the translation cell.** The translation cell is `flex items-start gap-2`; a trailing `w-6`-style slot would work, but because the textarea is `flex-1`, adding/removing the slot changes the textarea's available width (minor reflow). The pencil/clear control today already occupies this trailing position, so a permanent fixed-width slot here would also need to coexist with that control.

Recommendation for the marker: **absolute right-edge slot on the `relative` row**, reserving e.g. a `~24px` gutter, so the marker (outline = no note, filled = has note) is always in a stable position regardless of text length.

### Are rows focusable?

- The **`motion.div` row is NOT focusable** (no `tabIndex`, not a native interactive element).
- The **source cell `<button>` IS focusable**.
- The **translation `<Textarea>` IS focusable** (has `onFocus`).
- The translation wrapper `<div>` has `onClick` but no `tabIndex` → not keyboard-focusable.

Implication: a keyboard-accessible note affordance should be its **own `<button>`** (so it is focusable and Enter/Space-activatable); we cannot rely on the row itself receiving focus.

---

## 2. Existing pointer / focus / context handlers

### On notebook rows and their children (`NotebookPhase6.tsx`)

| Element | Handlers |
|---|---|
| Row `motion.div` | `onMouseEnter={() => setHoveredLineIndex(idx)}`, `onMouseLeave={() => setHoveredLineIndex(null)}` |
| Source `<button>` | `onClick={() => setCurrentLineIndex(idx)}` |
| Translation cell `<div>` | `onClick={() => setCurrentLineIndex(idx)}` |
| Translation `<Textarea>` | `onChange` (sets draft, current line, autosave timer), `onFocus={() => setCurrentLineIndex(idx)}`, `onKeyDown` (⌘↵ save, Enter→next line) |
| Clear `<button>` | `onClick` (stopPropagation, `clearDraft(idx)`) |

There is **no `onContextMenu` anywhere in the notebook surface today.**

### Global keydown listener in `NotebookPhase6` (relevant adjacency)

```tsx
// NotebookPhase6.tsx (~214) — ⌘/Ctrl+N toggles the (to-be-removed) notes panel
window.addEventListener("keydown", handleKeyDown);
// handler ignores INPUT/TEXTAREA/contentEditable and calls toggleNotesPanel()
```

This shortcut targets the old panel and will need re-pointing or removal during the rework.

### Every `onContextMenu` / global `contextmenu` in the codebase

`rg "[cC]ontext[mM]enu"` → **only two matches, both in `WordGrid.tsx`, both on word chips (never on a textarea/input):**

```tsx
// WordGrid.tsx:208 (and identical pattern at :1412)
onContextMenu={(e) => {
  if (!onSuggest) return;
  e.preventDefault();
  onSuggest({ word, originalWord: word, partOfSpeech: "neutral", position: index, sourceType: "source" });
}}
```

- **No global/document-level `contextmenu` listener exists anywhere.**
- This is the precedent for adding a row-level `onContextMenu` to open the note popover. Per Constraint 4, the handler must be attached to the **source cell / row**, never the translation `<Textarea>` (which must keep native paste/spellcheck).

---

## 3. Selection & per-row visual states

`notebook-row-selected` is applied as a className on the row when `isActive` (`idx === currentLineIndex`). It sets a background tint **and a left-edge inset accent bar**:

```css
/* globals.css:504 */
.notebook-row.notebook-row-selected {
  background-color: rgb(var(--notebook-line-selected) / 0.5);
  box-shadow: inset 3px 0 0 rgb(var(--color-accent));   /* LEFT edge accent */
}
.notebook-row.notebook-row-selected:hover { background-color: rgb(var(--notebook-line-selected) / 0.7); }
.notebook-row-selected .notebook-line-number { opacity: 1; color: rgb(var(--color-accent)); font-weight: 600; }
```

Other per-row / per-cell visual states:

- **Hover:** `.notebook-row:hover { background-color: var(--notebook-line-hover) }` (also brightens the line number). Note hover background is *also* set inline via framer-motion `animate.backgroundColor`, so there are two overlapping hover mechanisms.
- **Extra line:** `isExtraLine` adds `bg-purple-50/20` (row) and purple text/number tints.
- **Translation status (completed / draft / pending):** rendered by the **`NotebookStatusIndicator` icon** in the translation cell — *not* a row class. So note-presence is orthogonal to translation status as long as the marker lives in the right-edge gutter.

**Orthogonality conclusion:** the left edge is claimed by the selection accent bar; the status icon sits at the left of the translation cell. A note marker on the **right edge** of the row collides with nothing. Use a distinct channel (e.g. outline vs filled bookmark/dot) so it reads independently of selection blue and status icon.

---

## 4. Popover / Sheet / Dialog / Tooltip primitives

Installed Radix packages (from `package.json`) — **only two:**

```json
"@radix-ui/react-accordion": "^1.2.12",
"@radix-ui/react-select": "^2.2.6",
```

UI components present in `src/components/ui/`:

| Primitive | Status | Import path | Notes |
|---|---|---|---|
| **Sheet** | ✅ EXISTS (custom, non-Radix) | `@/components/ui/sheet` | Exports `Sheet`, `SheetContent` (`side="right"|"left"`, `max-w-[720px]`, slide-in animation, Esc-to-close, focus trap), `SheetHeader`, `SheetTitle`. Controlled via `open` / `onOpenChange`. Directly reusable for the "all notes" Sheet. |
| **Dialog** | ✅ EXISTS (custom, non-Radix) | `@/components/ui/dialog` | Controlled `open`/`onOpenChange`, focus trap, Esc-to-close. |
| **Popover** | ❌ MISSING | — | No `ui/popover.tsx`, no `@radix-ui/react-popover` dependency. |
| **Tooltip** | ❌ MISSING | — | No `ui/tooltip.tsx`, no `@radix-ui/react-tooltip` dependency. |

`Sheet` confirmation:

```tsx
// ui/sheet.tsx — controlled, custom, with focus trap + Esc
export function Sheet({ open, onOpenChange, children }) { … }
export function SheetContent({ side = "right", className = "", children, ariaLabelledby }) { … }
```

**Decision required for the per-line popover** (not a hard blocker — both paths are viable):

- **Option A (matches repo convention):** build a small custom `Popover` in the same controlled style as the existing custom `Sheet`/`Dialog` (anchor + positioned floating card, Esc/outside-click to close → "close = commit" per the rework spec). No new dependency.
- **Option B:** add `@radix-ui/react-popover` and wrap it. Introduces a new dependency + lockfile change (the repo otherwise uses hand-rolled overlays).

Given the existing pattern is hand-rolled custom overlays, **Option A is the lower-friction, convention-consistent choice.** Tooltip is not strictly required (the marker's two states + popover cover the affordance).

---

## 5. Per-line endpoint + `useSaveLineNote` (never exercised from UI)

### Request / response shape

`useSaveLineNote` (`src/lib/hooks/useNotebookNotes.ts`):

```ts
mutationFn: async (data: { lineIndex: number; content: string | null }) => {
  // POST /api/notebook/notes/line  body: { threadId, lineIndex, content }
}
onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notebook-notes", threadId] })
```

Route `POST /api/notebook/notes/line`:

- **Body schema:** `{ threadId: uuid, lineIndex: int >= 0, content: string | null }`.
- **Response:** `{ lineIndex, content, updatedAt }`.
- **Auth:** `requireUser()` then ownership check (`thread.created_by !== user.id → 403`). Correct.
- **Delete-on-null:** ✅ Correct — deletes the key when `content === null` **or** whitespace-only:

```ts
// notes/line/route.ts:85
const updatedLineNotes = { ...currentNotes.line_notes };
if (body.content === null || body.content.trim() === "") {
  delete updatedLineNotes[body.lineIndex];
} else {
  updatedLineNotes[body.lineIndex] = body.content;
}
```

The line endpoint preserves `thread_note` and stamps `updated_at`, then `patchThreadStateField(threadId, ["notebook_notes"], updatedNotes)`. **This path is correct and safe to activate.** Storage shape is honored (Constraint 1).

### 🐞 BUG FLAGGED — but it is in the *full* `/notes` route, not `/notes/line`

The full `POST /api/notebook/notes` route **cannot delete a line note**, because it merges by spread:

```ts
// notes/route.ts:170
line_notes: body.lineNotes
  ? { ...currentNotes.line_notes, ...body.lineNotes }   // merge-only; removed keys are NOT deleted server-side
  : currentNotes.line_notes,
```

Consequence with the **current** (old-panel) flow: `setLineNote(idx, null)` removes the key from the Zustand `lineNotes` object, and the panel then saves the whole object via `useSaveNotebookNotes` (the full route). Because the deleted key is simply absent from `body.lineNotes`, the server's spread-merge **keeps the old value** → **line-note deletions never persisted to the DB.** This is a latent, pre-existing bug that the rework will surface.

**Mitigation for the rework (no contract change needed):** route all per-line writes — including deletes — through `useSaveLineNote` → `/notes/line` (which deletes correctly). Reserve the full `/notes` route for `thread_note` updates. This also satisfies Constraints 1–3 with no migration.

---

## 6. Scroll / jump-to-line feasibility

`NotebookPhase6` already keeps per-line **textarea** refs and already calls `scrollIntoView` on them:

```tsx
// NotebookPhase6.tsx:71
const textareaRefs = React.useRef<Record<number, HTMLTextAreaElement | null>>({});

// NotebookPhase6.tsx:621 (Add-line flow already does this)
textarea.scrollIntoView({ behavior: "smooth", block: "center" });
```

So **jump-to-line is feasible today** via `textareaRefs.current[idx]?.scrollIntoView(...)` + focus. Caveat: this scrolls/focuses the *translation* textarea, which is fine. If we want to anchor on the row (to also flash the marker) we can add a parallel `rowRefs` record on the `motion.div`; this is a trivial additive change and recommended so "jump" can also highlight the row, not just focus an empty textarea.

---

## 7. Locale files needing new keys

`translalia-web/messages/` contains **9** files. Source keys go in `en.json`; per Constraint 6 the new keys must be **mirrored (English for now) into the other 8**:

- `en.json` (source of truth; keys under `Notebook`)
- `ar.json`
- `es.json`
- `es-AR.json`
- `hi.json`
- `ml.json`
- `ta.json`
- `te.json`
- `zh.json`

Existing notes keys already live under the `Notebook` namespace (e.g. `notesTitle`, `notesThreadTitle`, `notesLineTitle`, `notesLinePlaceholder`, `notesLineLabel`, `notesSelectLine`). New popover/Sheet strings should extend this same namespace.

---

## Risks / blockers

1. **No hard blocker on the right-edge slot.** The row is `grid grid-cols-2 relative`; an absolutely-positioned right-edge marker adds the affordance **without reflowing** the `flex-1 min-w-0` textarea. The Shared Context assumption holds — proceeding is safe.
2. **DECISION (not a blocker): Popover primitive is missing.** No `ui/popover.tsx`, no `@radix-ui/react-popover`. Recommend building a small custom controlled `Popover` matching the existing hand-rolled `Sheet`/`Dialog` pattern (Option A) rather than adding a Radix dependency. Confirm before implementing.
3. **Latent persistence bug to route around:** the full `POST /api/notebook/notes` merge-spreads `line_notes`, so it **cannot delete** a line note — meaning deletions via the old panel never persisted. The rework must send per-line writes/deletes through `useSaveLineNote` → `/api/notebook/notes/line` (which deletes correctly). No API contract change required.
4. **Constraint 4 adjacency:** the only `onContextMenu` precedent is on `WordGrid` word chips; there is no document-level contextmenu listener. New right-click handlers must attach to the **source cell / row**, never the translation `<Textarea>`.
5. **Hydration ownership moves:** today the one-time API→Zustand hydration lives inside `NotebookNotesPanel` (`isInitialLoad` guard). When that panel is removed (Prompt 5), the single-hydration guard (Constraint 3) must be relocated (e.g. into `NotebookPhase6` or a dedicated hook) so Zustand is still hydrated exactly once.
6. **Stale shortcut/state:** `⌘/Ctrl+N` + `notesExpanded`/`toggleNotesPanel`/`setNotesExpanded` exist only to serve the old panel and will become dead code after Prompt 5; flagged for cleanup, not changed here.
