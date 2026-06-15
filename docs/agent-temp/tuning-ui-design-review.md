# Translation Tuning — UI/UX design review

Reviewed with `/ui-ux-pro-max` against the project's own design system
(`DESIGN_PHILOSOPHY.md`, `tailwind.config.ts`, `globals.css`) and the reference
components it must match: `WorkshopRail.tsx`, `GuideRail.tsx`,
`CollapsedPanelTab.tsx`, `GuideSteps.tsx`.

**Scope:** `src/components/tuning/**` + the tuning page. UI-only / mock-data feature.

## Headline finding

The tuning UI was already in good shape: **zero hardcoded colors** (no hex, no
inline `rgb()`, no arbitrary color brackets), consistent `focus-visible` rings
(centralized in `uiClasses.ts`), correct `rounded-*` scale, correct
`duration-fast`/`duration-smooth` usage, and `font-serif` reserved for poem
content only. The issues found were **consistency drift and a few semantic-color
miscues**, not structural problems. All fixes below use existing tokens only and
have been implemented directly. `tsc --noEmit`, `eslint`, and `prettier` all pass.

---

## Changes implemented

### 1. Extracted a shared pill-toggle into `uiClasses.ts`
**Issue:** Two near-identical segmented toggles (header *Reasoning/Off* and detail
*Current/History*) duplicated their classes, and drifted: the header used `px-3`,
the detail used `px-4`. `uiClasses.ts` exists precisely to keep these
"pixel-identical across every tuning component."

**Fix:** Added `pillToggleContainer`, `pillToggle`, `pillToggleActive`,
`pillToggleInactive` and consumed them in both `TranslationTuningLayout.tsx` and
`NodeDetail.tsx`. Standardized on the compact `px-3 py-1 text-xs` form (these are
secondary toolbar toggles; the workshop's primary `WorkshopNavigationToggle`
stays larger at `px-4 py-1.5 text-sm`, which is correct for its role).

- `uiClasses.ts` — new shared exports
- `TranslationTuningLayout.tsx` — removed local `pillBase/pillActive/pillInactive`
- `NodeDetail.tsx` — removed local `pillBase/pillActive/pillInactive`

### 2. Title weight matches the app's heading convention
**Issue:** The header `<h1>` was `font-bold`. Every other heading in the tuning UI
(`NodeDetail` `h2`, `HistoryView` `h3`) and in `GuideRail`/`GuideSteps` uses
`font-semibold`. Apple-style "crisp hierarchy, minimal ornamentation" favors the
lighter weight.

**Fix:** `TranslationTuningLayout.tsx` — `text-base font-bold` → `text-base font-semibold`.

### 3. Separator dots use a text token, not a border token
**Issue:** The context-bar `·` separators used `text-border`, while the detail
sections (`ModelSettings`, `TranslationInstructions`) use `text-foreground-disabled`
for the same role. (`--color-border` and `--color-foreground-disabled` happen to
resolve to the same value, so this is about token *semantics* + consistency, not
appearance.)

**Fix:** `TranslationTuningLayout.tsx` — all three `text-border` `·` → `text-foreground-disabled`.

### 4. Contrast: descriptive paragraphs lifted off `foreground-muted`
**Issue:** `--color-foreground-muted` (`#A8A29E`) is ~2.6:1 on the base surface —
below WCAG AA (4.5:1) for normal text. It's the right token for tiny uppercase
eyebrows/captions (and is left as-is there), but it was being used for genuine
*sentence* content. `GuideRail`'s convention is `foreground-secondary` (`#57534E`,
~7:1) for meaningful secondary prose.

**Fix:**
- `NodeDetail.tsx` — node description → `text-foreground-secondary`
- `sections/TestRun.tsx` — the "Run your changes against Line 1…" intro → `text-foreground-secondary`

(Eyebrows, stat labels, and timeline captions intentionally stay `foreground-muted`
to preserve hierarchy — matching `WorkshopNavigationToggle` / notebook column headers.)

### 5. Semantic color: removed unmotivated green
The design philosophy is strict — *"green only for success confirmation,"
"don't let components invent colors."* Two spots used green for non-success state:

- **`ReasoningTrace.tsx`** — the numbered-steps rail was `border-success-light`
  while the step numbers are accent. Green here signals nothing (it's an AI
  reasoning trace, not a success state) and clashed with the accent numbers.
  → `border-accent/20`, so the rail visually belongs to its accent step markers.
- **`HistoryView.tsx`** — the "Current" badge was `bg-success-light / text-success`.
  "Current" is an **active** state, and the system marks active state with the
  accent (selected variant, active line, focused field).
  → `bg-accent/10 / text-accent`, matching the "Your tuning" accent header and the
  active-state convention everywhere else.

### 6. Test-run comparison: clearer baseline-vs-tuned + defined button
**Issue:** The side-by-side tints were faint (`bg-muted/50`, `bg-success-light/20`),
so the "improved" column barely separated from the baseline. The secondary
button used `border-border-subtle` (the *divider* weight) where interactive
outlines should use `border-border` (per `.btn-secondary` / `GuideRail.ghostBtn`).

**Fix (`sections/TestRun.tsx`):**
- Baseline panel `bg-muted/50` → `bg-muted`
- Tuned panel `bg-success-light/20` → `bg-success-light/40`
- "Reset to defaults" button `border-border-subtle` → `border-border`

---

## Reviewed and deliberately left as-is

- **`text-2xl` node-detail title.** Louder than the app's usual `text-xl` max, but
  the detail panel is the focal, near-modal surface of the view, so a step up in
  the type scale is justified. Sub-section headers correctly sit at `text-lg`
  (`HistoryView`) and the `text-xs` uppercase pattern (`SectionHeader`).
- **Two status metaphors on one page.** The pipeline timeline + scrubber use the
  **accent** as a progress-fill (done/running nodes are accent) — a "loading bar"
  metaphor. The Downstream list uses **semantic** status (green done / amber
  running / muted pending). Both are explicitly sanctioned by the philosophy
  (accent = progress indicator; green = completion of discrete work), so this dual
  metaphor is intentional, not drift.
- **Green / amber / red section dots** (`Translation Instructions` = safe,
  `Model Settings` = caution, `Output Requirements` = locked) — correct semantic
  use of success/warning/error. Kept.
- **Dashed section dividers** in the detail panel — `border-dashed border-border-subtle`
  appears in the app (notebook "add line"), reads as quiet, on-philosophy. Kept.
- **`font-mono`** on stats, model names, token counts, hashes — consistent. Kept.

## Recommendation not yet implemented (needs product call)

- **Touch targets on the playback scrubber.** Play/pause is `h-7 w-7` (28px) and
  the tick dots are ~6px with no expanded hit area — below the 44px guideline. The
  scrubber is *deliberately* the quietest control and is currently mock-only, and
  this is a desktop-first productivity tool, so it wasn't force-fixed. When the
  scrubber is wired to real playback, give the ticks a transparent padded hit area
  (e.g. `p-2 -m-2`) and bump the play button to `h-9 w-9` so it stays comfortably
  tappable without changing the visual footprint.

## Verification
- `npx tsc --noEmit` — clean (exit 0)
- `npx eslint src/components/tuning/ …/tuning/page.tsx` — clean
- `npx prettier --check` — all changed files already formatted

## Files touched
- `src/components/tuning/uiClasses.ts`
- `src/components/tuning/TranslationTuningLayout.tsx`
- `src/components/tuning/NodeDetail.tsx`
- `src/components/tuning/HistoryView.tsx`
- `src/components/tuning/sections/TestRun.tsx`
- `src/components/tuning/sections/ReasoningTrace.tsx`
