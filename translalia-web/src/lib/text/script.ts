/**
 * Script detection for segmentation routing.
 *
 * Deliberately classifies from the TEXT ITSELF and never from
 * `sourceLanguage` / `targetLanguage` / `poem_analysis`. See
 * `docs/04-investigations/cjk-segmentation-recon.md` §5: all three are
 * placeholder strings in production (`"the source language"` /
 * `"the target language"`), because nothing writes `poem_analysis` and the
 * current guide flow never populates `answers.targetLanguage`. Routing
 * segmentation off those values would route everything to the Latin path.
 *
 * Isomorphic: no Node-only or DOM-only APIs.
 */

export type ScriptClass = "latin" | "han" | "kana" | "thai" | "other";

/**
 * Scripts that are written without inter-word spaces. These route to
 * `Intl.Segmenter` in `segmentText`, and join with "" in `joinSegments`.
 */
export const UNSPACED_SCRIPTS: ReadonlySet<ScriptClass> = new Set<ScriptClass>([
  "han",
  "kana",
  "thai",
]);

// Hiragana + Katakana + Katakana Phonetic Extensions + halfwidth katakana.
// U+30FB (katakana middle dot) is real punctuation and is excluded;
// U+30FC (prolonged sound mark) is kept - it is a strong Japanese signal.
const KANA = /[\u3041-\u309F\u30A1-\u30FA\u30FC-\u30FF\u31F0-\u31FF\uFF66-\uFF9D]/u;

// CJK Unified Ideographs, Extension A, and Compatibility Ideographs, plus the
// astral-plane blocks: Extensions B-F and the Compatibility Supplement
// (U+20000-U+2FA1F), and Extensions G-I (U+30000-U+323AF).
//
// The astral blocks MUST be written as code-point escapes, not surrogate-pair
// ranges. The `u` flag makes the regex operate on code points, so a pattern
// like `[\\uD840-\\uD87F][\\uDC00-\\uDFFF]` never matches: U+2000B is a single
// code point to a `u`-mode regex, not two surrogates.
const HAN =
  /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u{20000}-\u{2FA1F}\u{30000}-\u{323AF}]/u;

const THAI = /[\u0E01-\u0E5B]/u;

// Latin incl. Latin-1 Supplement, Extended-A/B, and Latin Extended Additional.
const LATIN = /[A-Za-zÀ-ɏḀ-ỿ]/u;

/**
 * Any character that carries script identity. Punctuation, whitespace, digits,
 * and symbols are excluded so the majority vote in `detectScript` is over
 * "non-punctuation chars" as specified.
 */
function countScripts(text: string): {
  latin: number;
  han: number;
  kana: number;
  thai: number;
  otherLetters: number;
} {
  let latin = 0;
  let han = 0;
  let kana = 0;
  let thai = 0;
  let otherLetters = 0;

  // Iterate by code point, so astral-plane Han (Extension B+) counts once
  // rather than twice. Note this is a COUNTING concern only; the offsets in
  // `segmentText` are deliberately UTF-16 code units — see segmentText.ts.
  for (const ch of text) {
    if (KANA.test(ch)) {
      kana++;
    } else if (HAN.test(ch)) {
      han++;
    } else if (THAI.test(ch)) {
      thai++;
    } else if (LATIN.test(ch)) {
      latin++;
    } else if (/\p{L}/u.test(ch)) {
      // Devanagari, Arabic, Cyrillic, Hangul, Greek, … — all whitespace-
      // delimited for our purposes, so they fall through to "other".
      otherLetters++;
    }
    // Punctuation / digits / whitespace / symbols: intentionally uncounted.
  }

  return { latin, han, kana, thai, otherLetters };
}

/**
 * Classify a string's dominant script.
 *
 * Rules, in order:
 *  1. No CJK at all → `latin` if any Latin letters, else `thai` if Thai, else
 *     `other` if any other letters, else `other`.
 *  2. CJK present but Latin letters strictly outnumber CJK chars → `latin`.
 *     ("Mixed Latin+CJK → classify by majority of non-punctuation chars.")
 *  3. Otherwise CJK wins, and within CJK **any kana at all** → `kana`,
 *     even when Han is also present. Japanese prose is Han-heavy with sparse
 *     kana particles, so a kana-majority test would misclassify it as `han`.
 *
 * Rule 2 is applied before rule 3 on purpose: it stops a single stray kana or
 * Han character inside an otherwise-Latin line from flipping that line onto
 * the unspaced path, which would then join without spaces and corrupt it.
 * The "kana anywhere wins" rule is what disambiguates Japanese from Chinese;
 * it is not meant to override an overwhelming Latin majority.
 *
 * Per the ICU spike, `locale` is inert for Han-only text — `zh`, `ja`, `en`
 * and `und` all produce byte-identical segmentation. The han/kana distinction
 * therefore only changes behaviour on kana-bearing input, which is exactly
 * what this rule targets.
 */
export function detectScript(text: string): ScriptClass {
  if (!text) return "other";

  const { latin, han, kana, thai, otherLetters } = countScripts(text);
  const cjk = han + kana;

  if (cjk === 0) {
    if (thai > 0 && thai >= latin && thai >= otherLetters) return "thai";
    if (latin > 0) return "latin";
    if (otherLetters > 0) return "other";
    return "other";
  }

  // Mixed Latin + CJK: majority of script-bearing characters wins.
  if (latin > cjk) return "latin";

  // CJK-dominant. Kana anywhere means Japanese.
  return kana > 0 ? "kana" : "han";
}

/**
 * BCP-47 locale to hand `Intl.Segmenter` for a given script class.
 *
 * The ICU spike showed this is inert for Han-only text, but passing the
 * correct locale is still right: it matters for kana-bearing Japanese and for
 * Thai, and it documents intent.
 */
export function localeForScript(script: ScriptClass): string {
  switch (script) {
    case "kana":
      return "ja";
    case "han":
      return "zh";
    case "thai":
      return "th";
    default:
      return "en";
  }
}
