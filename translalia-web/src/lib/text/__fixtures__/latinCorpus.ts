/**
 * Corpus for the golden regression test: every line here must segment
 * byte-identically to `s.split(/\s+/).filter(Boolean)`.
 *
 * This is the guarantee that Phase 0 changes nothing for existing users. If a
 * line here fails, the implementation is wrong — not the test.
 *
 * PROVENANCE
 * The repo's only real line corpus is `scripts/investigation/
 * diversity-evaluation.ts` (`TEST_INPUTS`, 10 entries, 27 unique lines). All
 * 27 are used below, split into the Latin-script group and a non-Latin group.
 * The non-Latin group (Devanagari, Arabic) is load-bearing, not decoration:
 * those scripts are whitespace-delimited, so `detectScript` must classify them
 * as `other` and route them down the identical whitespace path. They would
 * catch an over-eager script detector that grabbed everything non-Latin.
 *
 * The fixture is thin, so it is topped up with the few-shot example lines
 * embedded in the prompt builders, and with a whitespace edge-case group that
 * the `split(/\s+/)` contract has to honour exactly (leading/trailing/repeated
 * whitespace, tabs, newlines, empty, punctuation-only, contractions, dashes).
 */

/**
 * Latin-script lines from `scripts/investigation/diversity-evaluation.ts`
 * (`TEST_INPUTS[*].lineText` and `.fullPoem`). French, Spanish, English.
 */
export const LATIN_FIXTURE_LINES: string[] = [
  "Je marche dans la pluie comme une pensée qui s'égare",
  "Le ciel pleure des larmes d'argent",
  "Et la ville s'endort sous son voile de brume",
  "El sol se pone detrás de las montañas",
  "Las sombras se alargan en el valle",
  "Y el día termina en silencio",
  "Como el viento entre los árboles, mi corazón suspira",
  "Buscando la paz que el mundo no ofrece",
  "En la quietud de la noche encuentro consuelo",
  "The stars are diamonds scattered across the velvet sky",
  "The moon rises like a silver coin",
  "And night embraces the sleeping world",
  "Time flows like a river with no return",
  "Each moment a drop in the ocean of memory",
  "We float on currents we cannot control",
];

/**
 * Few-shot example lines embedded in the prompt builders.
 * `src/lib/ai/workshopPrompts.ts` and `src/lib/ai/notebookSuggestionsPrompts.ts`.
 */
export const LATIN_PROMPT_EXAMPLE_LINES: string[] = [
  "El gato se sentó en la alfombra",
  "The sun rises in the morning",
  "The moon circles the earth",
  "The stars shine bright",
];

/**
 * Non-Latin but whitespace-delimited lines from the same fixture file.
 * Devanagari and Arabic. These must take the identical whitespace path.
 */
export const NON_LATIN_SPACED_LINES: string[] = [
  "चाँद की रोशनी में नदी चमकती है",
  "रात के सन्नाटे में एक गीत गूंजता है",
  "मेरी आत्मा शांति खोजती है",
  "प्यार एक समुद्र है जिसमें मैं डूबता हूँ",
  "हर लहर मुझे किनारे से दूर ले जाती है",
  "फिर भी मैं तैरता रहता हूँ",
  "القلب يحترق بنار الشوق",
  "والعين تبكي دموع الفراق",
  "والروح تطير إلى الحبيب",
];

/**
 * Whitespace edge cases. Every one of these is a shape `split(/\s+/)` handles
 * in a specific way that the scan-based implementation must reproduce.
 */
export const WHITESPACE_EDGE_CASES: string[] = [
  "",
  " ",
  "   ",
  "\t\n  ",
  "word",
  " leading",
  "trailing ",
  "  both  ",
  "double  space",
  "triple   space",
  "tab\tseparated",
  "newline\nseparated",
  "mixed \t\n whitespace",
  "árboles, mi corazón",
  "don't split contractions",
  "hyphen-joined stays whole",
  "em—dash—joined",
  "trailing punctuation.",
  "...",
  "!?",
  "1923 and 50% and $100",
  "MIXED case AND CAPS",
  "a b c d e f g",
];

/**
 * The full golden corpus. 51 entries.
 */
export const GOLDEN_LATIN_CORPUS: string[] = [
  ...LATIN_FIXTURE_LINES,
  ...LATIN_PROMPT_EXAMPLE_LINES,
  ...NON_LATIN_SPACED_LINES,
  ...WHITESPACE_EDGE_CASES,
];
