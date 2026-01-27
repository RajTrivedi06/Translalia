# Translalia UI Philosophy + Theme Guide

Here's a **UI philosophy + theme guide** you can hand to Claude Code (or a designer) to push the interface toward **modern minimal** with an **Apple × Notion** blend—while staying consistent across all current and future Translalia features.

---

## 1) North Star: "Poetic focus + high signal"

The interface should feel like a **calm translation workspace**: quiet, steady, and fast to work with during extended creative sessions. The user is thinking poetically and linguistically, not admiring UI.

* **High signal density, low visual noise**
* **Everything looks intentional**
* **No playful or "gaming" aesthetics**
* **Comfortable for 30–60 minute translation sessions**
* **Looks trustworthy (literary/creative context)**

The design should communicate: *"I can focus here and make thoughtful choices."*

---

## 2) Apple × Notion blend (what that means in practice)

### Apple-inspired

* **Crisp hierarchy**: strong typographic clarity, minimal ornamentation
* **Spatial polish**: generous whitespace, balanced margins, careful alignment
* **Subtle depth**: soft shadows only where needed; avoid heavy borders
* **Smoothness**: micro-interactions are buttery and consistent (hover/focus/transition)
* **Intentional color**: accent color used sparingly and consistently

### Notion-inspired

* **Document-first writing experience**: the translation editor should feel like writing in a premium doc tool, not a form from 2012
* **Neutral surfaces**: calm gray backgrounds, light cards, subtle dividers
* **Utility-driven UI**: chips, toggles, and controls are small and clean
* **Structured blocks**: sections are predictable, repeatable, and scannable

**Combined feel:** Apple polish + Notion practicality, inside a creative translation workflow.

---

## 3) Layout philosophy: "Two workspaces, one mind"

Your UI has two core mental modes:

1. **Workshop Mode** (left/center): source poem + line-by-line translation + variant selection (A/B/C) + word-level alignment
2. **Notebook Mode** (right/full): full translation assembly, editing, and comparison

The layout must support both without competing.

* The Workshop should feel like a **translation console** (observational, iterative, variant-focused).
* The Notebook should feel like a **writing surface** (primary, editable, comfortable for reading full poems).
* The UI should never make the user feel like they're "switching apps."

---

## 4) Visual system: minimalist tokens, maximal consistency

### Color philosophy

Use a mostly neutral palette with one accent:

* **Neutrals do 90%** of the work (background, text, dividers).
* **One primary accent** (teal/blue) for:

  * primary actions
  * active states (selected variant, active line, focused field)
  * progress indicators
* **Semantic colors are rare and meaningful**:

  * Red only for critical errors / destructive actions
  * Green only for success confirmation (completed lines, saved states)
  * Yellow/amber only for warnings / incomplete states

No rainbow. No multiple accents. Don't let components invent colors.

### Depth philosophy

* Use **one** shadow level for cards (soft, barely there).
* Use **borders** as the main separation tool (thin, subtle).
* Use **elevation sparingly** (only for sticky header/footer, modals, comparison sheets).

### Radius philosophy

* Consistent rounded corners across the app.
* Larger radius for top-level surfaces (cards), smaller for inner elements (chips, inputs, word tokens).

### Typography philosophy (extremely important)

Typography should carry hierarchy instead of color and borders.

* Clear page title
* Consistent card titles
* Form labels readable but understated
* Helper text quiet and secondary
* Source poem text and translation variants are the few things allowed to be "loud"

If typography is great, the UI automatically feels premium.

---

## 5) Interaction philosophy: "Predictable, frictionless, keyboard-friendly"

### Focus states

* Focus ring should be crisp and consistent (accent color).
* Avoid thick glowing rings; keep it refined.
* Inputs, chips, tabs, variant buttons, and word tokens all behave the same.

### Motion

* Subtle transitions: 150–200ms ease.
* No bouncy animations.
* Motion should indicate state change, not decorate.
* Drag-and-drop should feel smooth and responsive.

### Keyboard-first patterns

This is a productivity tool. It should be fast:

* Clear tab order
* Hotkeys (variant selection, line navigation, etc.)
* "Focus first field" behavior on mode switch
* Enter/escape behave predictably in modals
* Word token selection via keyboard

---

## 6) Information design: "Progressive disclosure"

Translation work is detail-rich. Don't show everything all the time.

* Default UI shows only what is needed **now**
* Advanced detail reveals on demand
* Use:

  * collapsible sections (word alignment details, additional suggestions)
  * accordions for stanza groups
  * "Get more suggestions" in a sheet/modal
  * lightweight tooltips, not paragraphs
  * comparison view as a contextual sheet, not always visible

This prevents the "translation UI explosion" problem.

---

## 7) Card and section design: "Repeatable patterns"

Every part of the app should feel like it's built from the same set of blocks.

### Cards

* Card header with title + optional right-side actions
* Body with clean spacing and predictable grid
* Optional footer for actions (rare)

### Sections inside Workshop

* Line number + source text (read-only, clear)
* Three variant buttons (A/B/C) with subtle differentiation
* Word-level alignment tokens (draggable, quiet)
* Additional suggestions panel (collapsible, unobtrusive)

### Sections inside Notebook

* Source poem column (read-only, reference)
* Translation poem column (editable, primary focus)
* Line-by-line editing with auto-resize textareas
* Completion status indicators (subtle)

### Consistency rule

If something looks like a chip here, it should look like a chip everywhere.
If something looks like a variant button, it should look identical across all lines.
If something looks like a word token, it should look identical in Workshop and Notebook.

---

## 8) The translation editor should feel like a "premium writing surface"

This is the core differentiator.

* Larger comfortable textareas (line height matters for poetry)
* Minimal borders, subtle background separation
* Variant suggestions should be **quiet**, not flashy
* Word tokens should feel like natural writing elements, not UI widgets
* Spacing should encourage flowing reading and writing
* Avoid heavy form-like styling (thick borders, boxed inputs everywhere)

Think: Notion/Apple Notes vibe, but structured for line-by-line poetry translation.

---

## 9) The Workshop panel should feel like a "translation console"

* Source poem is prominent, but not overwhelming
* Variant selection (A/B/C) feels like a polished segmented control
* Line navigation is clear and glanceable
* Word alignment tokens are large enough to read and drag comfortably
* Additional suggestions module looks modern:

  * single hero button
  * suggestions appear as quiet chips
  * reasoning text is clean and unobtrusive

Everything in the Workshop should be **stable** and **glanceable** while supporting iterative refinement.

---

## 10) Variant presentation: "Clear choice, subtle differentiation"

The three translation variants (A/B/C) are central to the workflow. They should feel like options, not competitors.

* Use structured sections:

  * variant label (A/B/C) is clear but not loud
  * variant text is the hero (readable, comfortable line height)
  * metadata (literalness, character count) is secondary and quiet
  * selection state is clear but refined
* Avoid gamification UI (badges, trophies, confetti)
* Variants are presented like thoughtful options, not prizes.

---

## 11) Word-level interaction: "Natural, not widgety"

Word tokens are draggable and interactive, but they should feel like part of the text, not separate UI elements.

* Word tokens should have subtle backgrounds (part-of-speech colors are quiet)
* Hover states should be refined, not flashy
* Drag preview should be smooth and clear
* Drop zones should be obvious but not aggressive
* Alignment visualization should be helpful, not distracting

---

## 12) Comparison and review: "Literary reference, not scorecard"

Comparison views and the Notebook should feel professional and calm.

* Use structured sections:

  * side-by-side source and translation
  * line-by-line alignment is clear
  * completion status is subtle
  * missing lines are indicated quietly
* Avoid gamification UI (badges, trophies, confetti)
* Export options are presented like document tools, not achievements.

---

## 13) Microcopy tone: calm, literary, supportive

No hype. No slang. No "Congrats!" energy.

* "Saved just now"
* "Select a variant or write your own"
* "Additional suggestions available"
* "Translation complete"
* "Reference only"

This builds trust in a literary/creative translation context.

---

## 14) Guide Rail (setup): "Thoughtful onboarding, not wizard"

The initial setup flow should feel like a conversation, not a form.

* Questions are presented clearly and sequentially
* Translation intent textarea feels like a writing surface
* Language/variety selection is clean and scannable
* Viewpoint range (focused/balanced/adventurous) is clear but not overwhelming
* The flow should feel like preparation, not bureaucracy

---

## 15) Diary (archive): "Quiet library, not trophy case"

The archive of completed poems should feel like a personal library.

* Poem cards are clean and scannable
* Metadata (dates, languages) is secondary
* Journey summaries are presented like reflections, not reports
* Notes are integrated naturally
* The focus is on the work, not the completion

---

## 16) Quality bar checklist (what "modern minimal" means here)

If the UI is done right, it should pass these tests:

* **Squint test:** you can still tell what's primary vs secondary.
* **Glance test:** source poem + current line + variants are instantly readable.
* **Consistency test:** every chip/button/input/variant looks like it belongs to one system.
* **Noise test:** nothing screams for attention unless it's truly important (like an unsaved change).
* **Translation test:** a translator can move fast between variants and lines without getting lost.
* **Reading test:** the full translation in Notebook reads like a poem, not a form.

---
