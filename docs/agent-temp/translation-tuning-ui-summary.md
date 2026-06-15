# Translation Tuning (Beta) — UI build summary

Status: **UI-only, mock data throughout.** No API/store wiring, no LLM calls.
Last pass: animation / transition / accessibility polish.

## Route

| File | Purpose |
|------|---------|
| `translalia-web/src/app/[locale]/(app)/workspaces/[projectId]/threads/[threadId]/tuning/page.tsx` | Client page. Reads `projectId`/`threadId` via `useParams`, holds `selectedNodeId`, composes the layout + timeline + downstream + scrubber from mock data. |

## Components (`translalia-web/src/components/tuning/`)

| File | Purpose |
|------|---------|
| `mockData.ts` | All hardcoded data + types: `sourcePoem`, `pipelineStats`, `lineInfo`, `presets`, `pipelineNodes` (5 nodes), `promptReasoning`, `testRunResult`, `promptHistory`, `downstreamFeatures`. |
| `uiClasses.ts` | Shared interaction classes for consistency: `focusRing`, `textLink`, `editableValue`. |
| `TranslationTuningLayout.tsx` | Page shell: header (back link, BETA badge, preset `Select`, Save preset, Reasoning/Off pill), context/stats bar, scrollable `main`, pinned `footer` slot. Owns the staggered entry animation. |
| `PipelineTimeline.tsx` | The 5-node timeline (horizontal row ≥ md, stacked column < md). Renders `NodeDetail` below it. |
| `NodeDetail.tsx` | Inline-expanding detail panel: open / close / node-switch animations, Current↔History tabs, Escape-to-close. Contains `GenericDetail` (non-prompt nodes). |
| `HistoryView.tsx` | "History" tab — recent runs as quiet rows. |
| `DownstreamAnalysis.tsx` | Collapsible downstream feature list (Notebook Analysis, Rhyme Workshop, Poem-Level Suggestions, Verification & Grade). |
| `PlaybackScrubber.tsx` | Quiet bottom playback bar: play/pause, progress line with node ticks + tooltips, time, replay. |
| `sections/SectionHeader.tsx` | Shared section header (status dot + tracked title + status word + right slot). |
| `sections/TranslationInstructions.tsx` | Prose instructions with highlighted source line + inline editable Style/Tone/Liberty. |
| `sections/ModelSettings.tsx` | Inline editable model/temperature/max-tokens/reasoning row. |
| `sections/OutputRequirements.tsx` | Muted, locked requirements section. |
| `sections/TestRun.tsx` | Test-run actions + side-by-side comparison + validation pills. |
| `sections/ReasoningTrace.tsx` | Numbered AI reasoning steps with the success-light rail. |

## Polish applied in this pass

**Animations**
- Staggered page entry: header (0ms) → context bar (`delay-100`) → main/timeline (`delay-200`), opacity fade `duration-300` (< 600ms total).
- Node-switch cross-fade in `NodeDetail`: content fades out, swaps while hidden (so a differing height never jumps), fades back in.
- Pipeline progress line: the frontmost filled segment uses `bg-gradient-to-r from-accent to-accent/50` for directionality.
- Running node: `animate-pulse` + `ring-2 ring-accent/50` (the pulse oscillates the ring's effective opacity ~/25–/50).
- Downstream expand: `max-h` height transition `duration-300 ease-out`; content fades in with `delay-150`.
- Tab switch (Current↔History): opacity cross-fade, content swaps while hidden (no layout shift).

**Hover / focus** (centralized in `uiClasses.ts`)
- Node circles: `group-hover:ring-2 group-hover:ring-accent/30`.
- Editable values + pencils warm to accent on hover; text links underline on hover with a consistent color.
- Every link/button/tick/row carries the standard `focus-visible` ring; downstream rows use `ring-inset`.

**Keyboard / a11y**
- All controls are native `<button>`/`Link` (Enter/Space work). Pipeline nodes, toggle, downstream toggle, scrubber play/pause, ticks all focusable.
- Current/History toggle: `role="tablist"`/`role="tab"`/`aria-selected`, arrow keys switch.
- Escape closes the detail panel (deselects the node).
- Tab order follows DOM: header → timeline nodes → detail → downstream → scrubber.

**Responsive**
- Timeline: `grid-cols-1 gap-8` below md, `md:grid-cols-5 md:gap-0` above; horizontal connectors hidden < md.
- TestRun comparison: `grid-cols-1 md:grid-cols-2`. Header/context bars wrap.

**Consistency / theming**
- Only semantic tokens (`text-foreground[-secondary|-muted]`, `bg-accent`, `border-border-subtle`, …) + standard utilities. No hex / arbitrary values / inline styles. Dark mode is handled automatically by the CSS variables.

## Known approximations / deliberate deviations
- **Height animations** use `max-h-0 ↔ max-h-screen` (standard utilities) rather than a measured height, because the rules forbid inline styles / arbitrary values and CSS can't animate to `auto`. `NodeDetail` drops the cap to `max-h-none` after opening so the tall Prompt view isn't clipped; on close it re-caps to `max-h-screen` before collapsing (a minor snap only when content exceeds the viewport, largely masked by the fade).
- **Running pulse ring** approximates the requested /30↔/60 oscillation via `animate-pulse` on `ring-accent/50` (no custom keyframe needed).
- **Downstream summary counts** are derived from the data (2 done / 1 running / 1 pending), not the literal "3 pending" in the original 6-feature mockup.
- **Scrubber** is pinned via the layout's flex column (reliable for short pages) and also carries `sticky bottom-0`.

## Verification
- `npx tsc --noEmit` — clean.
- `npx eslint src/components/tuning/ …/tuning/page.tsx` — clean.
- `npx prettier --write` — applied.
