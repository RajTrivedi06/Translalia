# Translation Tuning — animation review & enhancement

Audited with `/ui-animation` against Translalia's motion language: Apple-inspired,
`ease-smooth` = `cubic-bezier(0.4,0,0.2,1)`, 150/200/300ms tiers, **no
spring/bounce/elastic**, motion communicates state, `prefers-reduced-motion`
respected. All changes implemented directly. `tsc`, `eslint`, `prettier` pass.

## Before / After / Why

| Before | After | Why |
|---|---|---|
| `transition-all` on node circle, pill toggles, both TestRun buttons, and both expand containers | `transition` (curated) / `transition-colors` / `transition-[grid-template-rows]` / `transition-[opacity,transform]` | `transition: all` watches every property (incl. layout) and can animate unintended changes; target exact properties. |
| NodeDetail expand: `max-h-0 ↔ max-h-screen ↔ max-h-none` + `transition-all` | `grid-template-rows: 0fr ↔ 1fr` with an `overflow-hidden` wrapper | Animating `max-height` to a guess (`screen`) is janky and clipped tall content; the grid-rows technique animates to content height with no measuring, no clip, and no close-time snap. Removed the `capRemoved`/`max-h-none` hack entirely. |
| DownstreamAnalysis expand: same `max-h` + `transition-all` | Same grid-rows technique | Consistency + same jank fix. |
| Content fade tied to the same height timing | Two-phase: row expands (300ms `ease-smooth`), content fades in 150ms later (200ms) | Content arriving after the container settles reads as deliberate, not simultaneous blur. |
| Page entry: opacity-only stagger at 0/100/200ms | Coordinated fade **+ 6px rise** (`translate-y-1.5→0`), tightened to 0/75/150ms, `ease-smooth` | Pure opacity blinks on; a small rise makes regions read as *arriving*. Tighter cascade feels intentional, not mechanical (total ≈375ms). |
| Running node: Tailwind `animate-pulse` on the whole dot | Solid dot + separate **breathing halo ring** (`tuning-breathe`, opacity 1↔0.55) | `animate-pulse` dimmed the entire node (looked like it was disappearing). An opacity-only halo conveys "live" without scale/bounce — on tone. |
| Connector fill appeared instantly | Filled segments **draw in left→right** via `scale-x-0→100` (`origin-left`, 500ms, staggered by node index) | Progressive revelation reads as the pipeline advancing rather than snapping complete. |
| No processing indicator on the connector | **Traveling accent dot** on the running node's incoming segment (`tuning-flow`, opacity ≈0.5) | Conveys data flowing into the active stage. Uses `translateX(100cqw)` so it traverses the segment width with **transform only** — no `left`/`width` (layout) animation. The segment sets `container-type: inline-size`. |
| Done checkmark just rendered ("popped") | Check **fades + scales in** `0.85→1` (`tuning-pop-in`, 250ms `ease-out`, no overshoot) | Settles in rather than popping; no bounce. |
| Scrubber tooltip: opacity-only fade | Fade **+ 4px upward rise** (`translate-y-1→0`, `transition-[opacity,transform]` 150ms `ease-out`) | Tooltips that rise as they appear feel anchored to their trigger. |
| Scrubber fill hardcoded `w-4/5`, handle static | Fill width driven by `progressPercent` with `transition-[width] duration-smooth ease-smooth` | The handle (a child at the fill's right edge) now glides as progress advances during replay instead of jumping between ticks. |
| Paused handle inert | **Breathing** while paused (`tuning-breathe`, opacity, only when `!playing`) | Communicates a held/paused state quietly. |

## prefers-reduced-motion (accessibility)

Three layers, so the page is fully functional with zero motion:

1. **Global rule** (pre-existing, `globals.css`) forces `transition-duration` and
   `animation-duration` to ~0 and `animation-iteration-count: 1` for everything.
2. **`motion-safe:` gating** on every new keyframe animation (traveling dot,
   halo, check pop-in, paused handle) so they don't even attach under reduced
   motion; `motion-reduce:transition-none` on the grid/line/row transitions and
   `motion-reduce:delay-0` on the entry cascade so nothing waits on a delay; the
   flow dot also gets `motion-reduce:hidden`.
3. **`useReducedMotion` hook** (new, `src/components/tuning/useReducedMotion.ts`)
   drives the JS choreography in `NodeDetail`: under reduced motion the
   open/close/switch timers are skipped and the panel + content appear/disappear
   instantly. Color-based state (done/running/pending, dots, badges) is untouched.

## Key technique decisions (deliberate)

- **grid-rows over max-height / measured height** for both expanders — the modern
  jank-free pattern for unknown-height content; the task's "proper technique that
  doesn't cause jank."
- **Traveling dot uses `cqw` + `translateX`** (compositor-friendly, transform
  only) rather than animating `left`/`width`. Requires `container-type:inline-size`
  on the connector segment.
- **Scrubber fill uses a `width` transition** (not `scaleX`). `scaleX` would
  distort the handle child; the fill is an isolated absolutely-positioned bar, so
  a width transition causes no sibling reflow. Documented exception to the
  transform-only preference.
- **No spring/bounce anywhere:** every curve is `ease-smooth` (panels/lines) or
  `ease-out` (entrances); scale-ins go `0.85→1` with no overshoot; "alive" states
  (halo, paused handle) are **opacity-only** breathes.
- **Tab cross-fade kept:** content swaps while hidden (opacity 0), so the grid row
  re-sizes between the differently-tall Current/History views without a visible
  jump — addresses the layout-shift concern without measuring a min-height.

## New keyframes (`globals.css`)
`tuning-flow` (connector dot, `translateX(100cqw)` + opacity) · `tuning-breathe`
(opacity 1↔0.55, shared by running halo + paused handle) · `tuning-pop-in`
(checkmark, scale 0.85→1 + opacity).

## Verification
- `npx tsc --noEmit` — clean (exit 0)
- `npx eslint src/components/tuning/` — clean
- `npx prettier --write` — applied
- Note: this is a UI-only / mock-data feature, so live state transitions
  (running→done) can't be exercised at runtime yet; the running-node and
  draw-in treatments are built so they're correct once real pipeline state is
  wired in. Not verified in a live browser.

## Files touched
- `src/app/globals.css` (3 keyframes)
- `src/components/tuning/useReducedMotion.ts` (new)
- `src/components/tuning/TranslationTuningLayout.tsx`
- `src/components/tuning/PipelineTimeline.tsx`
- `src/components/tuning/NodeDetail.tsx`
- `src/components/tuning/DownstreamAnalysis.tsx`
- `src/components/tuning/PlaybackScrubber.tsx`
- `src/components/tuning/uiClasses.ts`
- `src/components/tuning/sections/TestRun.tsx`
