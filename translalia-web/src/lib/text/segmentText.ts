/**
 * Script-aware text segmentation.
 *
 * One utility, two consumers:
 *  - Gates want punctuation (the structural signature counts it; CJK
 *    punctuation being invisible to that counter is part of why all three
 *    variants collapse to the same `c0d0k0s0` signature — recon §4).
 *  - UI wants punctuation rendered non-draggable.
 *
 * So this never filters. Every segment comes back carrying a `wordLike`
 * boolean and consumers decide. No re-splitting downstream.
 *
 * Isomorphic: no Node-only or DOM-only APIs. Both server routes and client
 * components import this module.
 *
 * See `docs/04-investigations/cjk-segmentation-recon.md` for why this exists.
 */

import {
  detectScript,
  localeForScript,
  UNSPACED_SCRIPTS,
  type ScriptClass,
} from "./script";

export interface Segment {
  /** The segment as it appears in the source string. */
  text: string;
  /**
   * Start offset into the ORIGINAL string, in **UTF-16 code units**.
   *
   * Code units, not code points, on purpose: this is the same basis as
   * `String.length`, which is what `metadata.characterCount` already uses
   * everywhere (`translateLineWithRecipesInternal.ts:1161`,
   * `translateLineInternal.ts:337`). Using code points here would introduce a
   * second, silently incompatible offset basis into the same codebase.
   *
   * Consequence: astral-plane characters (CJK Extension B+, emoji) advance
   * offsets by 2 per character. `text.slice(start, end)` still round-trips
   * exactly, because `String.prototype.slice` is also code-unit based. This is
   * a documented known limitation, covered by a test, and deliberately not
   * "fixed" — see `__tests__/segmentText.test.ts`.
   */
  start: number;
  /** End offset (exclusive) into the original string, in UTF-16 code units. */
  end: number;
  /**
   * True for word-ish segments, false for punctuation and symbols.
   *
   * On the unspaced path this is `Intl.Segmenter`'s own `isWordLike`. On the
   * whitespace path it is "contains at least one letter or digit" — note that
   * a whitespace token keeps its attached punctuation (`"árboles,"` stays one
   * segment) and is still `wordLike: true`, because splitting it would break
   * byte-identical parity with `split(/\s+/)`.
   */
  wordLike: boolean;
}

/** Matches a segment carrying at least one letter or number. */
const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;

let warnedMissingSegmenter = false;

function hasIntlSegmenter(): boolean {
  return (
    typeof Intl !== "undefined" &&
    typeof (Intl as { Segmenter?: unknown }).Segmenter === "function"
  );
}

/**
 * Whitespace segmentation with offsets computed by scan.
 *
 * `/\S+/g` is exactly equivalent to `s.split(/\s+/).filter(Boolean)` for the
 * resulting token texts — same `\s` class, so leading/trailing/repeated
 * whitespace and the empty string all agree — while additionally yielding the
 * offsets that `split` throws away. The golden test asserts that equivalence
 * over a corpus and must never be relaxed.
 */
function segmentByWhitespace(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const value = match[0];
    segments.push({
      text: value,
      start: match.index,
      end: match.index + value.length,
      wordLike: HAS_WORD_CHAR.test(value),
    });
  }

  return segments;
}

/**
 * Per-character segmentation. Only used when `Intl.Segmenter` is unavailable,
 * which on our stack should never happen: every API route runs on the Node
 * runtime (no route in the repo opts into edge) and all supported browsers
 * ship the Segmenter. This exists so a missing ICU degrades to something
 * usable rather than throwing.
 */
function segmentByCharacter(text: string): Segment[] {
  const segments: Segment[] = [];
  let offset = 0;

  // Iterating a string yields code points, so a surrogate pair stays intact
  // as one segment while `offset` still advances by its code-unit length.
  for (const ch of text) {
    if (ch.trim()) {
      segments.push({
        text: ch,
        start: offset,
        end: offset + ch.length,
        wordLike: HAS_WORD_CHAR.test(ch),
      });
    }
    offset += ch.length;
  }

  return segments;
}

/**
 * Dictionary-based segmentation via `Intl.Segmenter`.
 *
 * Keeps every segment, punctuation included, tagging each with the
 * segmenter's own `isWordLike`. Pure-whitespace segments are dropped: they are
 * not tokens, and dropping them is what lets `joinSegments` round-trip
 * space-free CJK exactly.
 */
function segmentByIntl(text: string, locale: string): Segment[] {
  const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  const segments: Segment[] = [];

  for (const part of segmenter.segment(text)) {
    if (!part.segment.trim()) continue;
    segments.push({
      text: part.segment,
      start: part.index,
      end: part.index + part.segment.length,
      wordLike: part.isWordLike === true,
    });
  }

  return segments;
}

/**
 * Segment `text` into tokens with offsets, routed by detected script.
 *
 * - `latin` / `other` → whitespace segmentation (byte-identical to
 *   `split(/\s+/).filter(Boolean)`, plus offsets and the `wordLike` flag).
 * - `han` / `kana` / `thai` → `Intl.Segmenter` with `granularity: "word"`.
 *
 * Thai routes to the segmenter alongside han/kana because it is likewise
 * written without inter-word spaces and `joinSegments` already treats it as
 * unspaced. It is otherwise untested here — no Thai fixture exists yet.
 *
 * Invariant, guaranteed by test for every returned segment:
 *   `text.slice(seg.start, seg.end) === seg.text`
 */
export function segmentText(text: string): Segment[] {
  if (!text) return [];

  const script = detectScript(text);

  if (!UNSPACED_SCRIPTS.has(script)) {
    return segmentByWhitespace(text);
  }

  if (!hasIntlSegmenter()) {
    if (!warnedMissingSegmenter) {
      warnedMissingSegmenter = true;
      console.warn(
        "[segmentText] Intl.Segmenter unavailable; falling back to " +
          "per-character segmentation for unspaced scripts. Word-level " +
          "features will be degraded."
      );
    }
    return segmentByCharacter(text);
  }

  return segmentByIntl(text, localeForScript(script));
}

/**
 * The separator this script joins tokens with: `" "` for spaced scripts,
 * `""` for unspaced ones.
 *
 * Exposed so callers that append one token at a time (rather than joining a
 * whole array) use the same rule as `joinSegments` instead of hardcoding it.
 */
export function separatorForScript(script: ScriptClass): string {
  return UNSPACED_SCRIPTS.has(script) ? "" : " ";
}

/**
 * Re-join segments for the given script.
 *
 * `" "` for spaced scripts (`latin`, `other`), `""` for unspaced ones
 * (`han`, `kana`, `thai`). Accepts either `Segment[]` or plain strings so
 * callers that have already mapped to text do not have to reconstruct offsets.
 *
 * Round-trips exactly for space-free unspaced input:
 *   `joinSegments(segmentText(s), detectScript(s)) === s`
 * It does not round-trip input whose original whitespace carried information
 * (a CJK line containing spaces, or Latin input with runs of whitespace) —
 * whitespace is normalised to a single separator by design.
 */
export function joinSegments(
  segments: Segment[] | string[],
  script: ScriptClass
): string {
  const parts = segments.map((s) => (typeof s === "string" ? s : s.text));
  return parts.join(separatorForScript(script));
}

export { detectScript, localeForScript, UNSPACED_SCRIPTS };
export type { ScriptClass };
