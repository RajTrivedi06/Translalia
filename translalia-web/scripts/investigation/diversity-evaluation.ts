/**
 * INVESTIGATION SCRIPT: Diversity Evaluation Harness
 *
 * Compares Method 1 (P1 Literalness Spectrum) vs Method 2 (P6-P8 Recipe-Driven Prismatic)
 * for diversity, alignment quality, and latency.
 *
 * USAGE:
 *   npx tsx scripts/investigation/diversity-evaluation.ts
 *
 * ENV REQUIREMENTS:
 *   - OPENAI_API_KEY (required)
 *   - DEBUG_VARIANTS=1 (optional, for verbose output)
 *
 * This script is DEV-ONLY and does NOT affect production behavior.
 */

import OpenAI from "openai";

// ============================================================================
// Types
// ============================================================================

interface TranslationVariant {
  variant: number;
  fullText: string;
  words: Array<{
    original: string;
    translation: string;
    partOfSpeech: string;
    position: number;
  }>;
  metadata: {
    literalness: number;
    characterCount: number;
  };
}

interface LineTranslationResponse {
  lineOriginal: string;
  translations: TranslationVariant[];
  modelUsed: string;
}

interface DiversityMetrics {
  jaccardOverlap: {
    v1v2: number;
    v1v3: number;
    v2v3: number;
    avg: number;
  };
  bigramOverlap: {
    v1v2: number;
    v1v3: number;
    v2v3: number;
    avg: number;
  };
  uniqueTokens: {
    v1: number;
    v2: number;
    v3: number;
    total: number;
    uniqueAcrossAll: number;
  };
  openingDiversity: {
    sameFirst3Tokens: boolean;
    sameFirstWord: boolean;
  };
  structuralDiversity: {
    subjectOpeners: string[];
    comparisonMarkers: string[];
    hasPronounShift: boolean;
  };
}

interface EvaluationResult {
  input: TestInput;
  method1: {
    variants: TranslationVariant[];
    metrics: DiversityMetrics;
    latencyMs: number;
    error?: string;
  };
  method2: {
    variants: TranslationVariant[];
    metrics: DiversityMetrics;
    latencyMs: number;
    regenCount: number;
    error?: string;
  };
  comparison: {
    method2MoreDiverse: boolean;
    diversityDelta: number;
    verdict: "method2-wins" | "method1-wins" | "tie";
  };
}

interface TestInput {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  lineText: string;
  fullPoem: string;
  lineIndex: number;
  category: "metaphor-heavy" | "plain" | "idiom" | "cultural";
}

// ============================================================================
// Test Cases (diverse set covering multiple languages and line types)
// ============================================================================

const TEST_INPUTS: TestInput[] = [
  // French -> English (metaphor-heavy)
  {
    id: "fr-en-1",
    sourceLanguage: "French",
    targetLanguage: "English",
    lineText: "Je marche dans la pluie comme une pensée qui s'égare",
    fullPoem:
      "Je marche dans la pluie comme une pensée qui s'égare\nLe ciel pleure des larmes d'argent\nEt la ville s'endort sous son voile de brume",
    lineIndex: 0,
    category: "metaphor-heavy",
  },
  {
    id: "fr-en-2",
    sourceLanguage: "French",
    targetLanguage: "English",
    lineText: "Le ciel pleure des larmes d'argent",
    fullPoem:
      "Je marche dans la pluie comme une pensée qui s'égare\nLe ciel pleure des larmes d'argent\nEt la ville s'endort sous son voile de brume",
    lineIndex: 1,
    category: "metaphor-heavy",
  },
  // Spanish -> English (plain)
  {
    id: "es-en-1",
    sourceLanguage: "Spanish",
    targetLanguage: "English",
    lineText: "El sol se pone detrás de las montañas",
    fullPoem:
      "El sol se pone detrás de las montañas\nLas sombras se alargan en el valle\nY el día termina en silencio",
    lineIndex: 0,
    category: "plain",
  },
  {
    id: "es-en-2",
    sourceLanguage: "Spanish",
    targetLanguage: "English",
    lineText: "Como el viento entre los árboles, mi corazón suspira",
    fullPoem:
      "Como el viento entre los árboles, mi corazón suspira\nBuscando la paz que el mundo no ofrece\nEn la quietud de la noche encuentro consuelo",
    lineIndex: 0,
    category: "metaphor-heavy",
  },
  // Hindi -> English (morphologically rich)
  {
    id: "hi-en-1",
    sourceLanguage: "Hindi",
    targetLanguage: "English",
    lineText: "चाँद की रोशनी में नदी चमकती है",
    fullPoem:
      "चाँद की रोशनी में नदी चमकती है\nरात के सन्नाटे में एक गीत गूंजता है\nमेरी आत्मा शांति खोजती है",
    lineIndex: 0,
    category: "plain",
  },
  {
    id: "hi-en-2",
    sourceLanguage: "Hindi",
    targetLanguage: "English",
    lineText: "प्यार एक समुद्र है जिसमें मैं डूबता हूँ",
    fullPoem:
      "प्यार एक समुद्र है जिसमें मैं डूबता हूँ\nहर लहर मुझे किनारे से दूर ले जाती है\nफिर भी मैं तैरता रहता हूँ",
    lineIndex: 0,
    category: "metaphor-heavy",
  },
  // Arabic -> English
  {
    id: "ar-en-1",
    sourceLanguage: "Arabic",
    targetLanguage: "English",
    lineText: "القلب يحترق بنار الشوق",
    fullPoem:
      "القلب يحترق بنار الشوق\nوالعين تبكي دموع الفراق\nوالروح تطير إلى الحبيب",
    lineIndex: 0,
    category: "metaphor-heavy",
  },
  // Chinese -> English
  {
    id: "zh-en-1",
    sourceLanguage: "Chinese",
    targetLanguage: "English",
    lineText: "月光洒落窗前如银水",
    fullPoem: "月光洒落窗前如银水\n秋风轻抚竹叶声\n思念远方的故人",
    lineIndex: 0,
    category: "metaphor-heavy",
  },
  // English -> Spanish (reverse direction for comparison)
  {
    id: "en-es-1",
    sourceLanguage: "English",
    targetLanguage: "Spanish",
    lineText: "The stars are diamonds scattered across the velvet sky",
    fullPoem:
      "The stars are diamonds scattered across the velvet sky\nThe moon rises like a silver coin\nAnd night embraces the sleeping world",
    lineIndex: 0,
    category: "metaphor-heavy",
  },
  {
    id: "en-es-2",
    sourceLanguage: "English",
    targetLanguage: "Spanish",
    lineText: "Time flows like a river with no return",
    fullPoem:
      "Time flows like a river with no return\nEach moment a drop in the ocean of memory\nWe float on currents we cannot control",
    lineIndex: 0,
    category: "idiom",
  },
];

// ============================================================================
// OpenAI Client Setup
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.TRANSLATOR_MODEL || "gpt-4o";

// ============================================================================
// Metric Computation Utilities
// ============================================================================

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function tokenizeSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

function getBigrams(tokens: string[]): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.add(`${tokens[i]}|${tokens[i + 1]}`);
  }
  return bigrams;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

function detectSubjectOpener(text: string): string | null {
  const toks = tokenize(text);
  if (toks.length < 2) return null;

  const first = toks[0];
  if (/^(i|im|i'm)$/i.test(first)) return "I";
  if (/^(we|us)$/i.test(first)) return "we";
  if (/^(you|your)$/i.test(first)) return "you";
  if (/^(he|she|it|they)$/i.test(first)) return "3rd-person";
  if (/^(the)$/i.test(first)) return "the-NP";
  if (/^(a|an)$/i.test(first)) return "indef-NP";
  return null;
}

function detectComparisonMarker(text: string): string | null {
  const norm = text.toLowerCase();
  const markers = [
    "as if",
    "as though",
    "like",
    "as",
    "comme si",
    "comme",
    "como si",
    "como",
  ];
  for (const m of markers.sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${m.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (re.test(norm)) return m;
  }
  return null;
}

function computeDiversityMetrics(
  variants: TranslationVariant[]
): DiversityMetrics {
  const texts = variants.map((v) => v.fullText);
  const tokenSets = texts.map(tokenizeSet);
  const tokenLists = texts.map(tokenize);
  const bigramSets = tokenLists.map(getBigrams);

  // Jaccard overlap
  const j12 = jaccardSimilarity(tokenSets[0], tokenSets[1]);
  const j13 = jaccardSimilarity(tokenSets[0], tokenSets[2]);
  const j23 = jaccardSimilarity(tokenSets[1], tokenSets[2]);

  // Bigram overlap
  const b12 = jaccardSimilarity(bigramSets[0], bigramSets[1]);
  const b13 = jaccardSimilarity(bigramSets[0], bigramSets[2]);
  const b23 = jaccardSimilarity(bigramSets[1], bigramSets[2]);

  // Unique tokens
  const allTokens = new Set([
    ...tokenSets[0],
    ...tokenSets[1],
    ...tokenSets[2],
  ]);

  // Opening diversity (first 3 tokens)
  const first3 = tokenLists.map((tl) => tl.slice(0, 3).join(" "));
  const sameFirst3 =
    first3[0] === first3[1] ||
    first3[0] === first3[2] ||
    first3[1] === first3[2];
  const firstWord = tokenLists.map((tl) => tl[0] ?? "");
  const sameFirstWord =
    firstWord[0] === firstWord[1] ||
    firstWord[0] === firstWord[2] ||
    firstWord[1] === firstWord[2];

  // Structural diversity
  const subjectOpeners = texts
    .map(detectSubjectOpener)
    .filter((s): s is string => s !== null);
  const comparisonMarkers = texts
    .map(detectComparisonMarker)
    .filter((m): m is string => m !== null);

  const pronouns = ["I", "we", "you", "3rd-person"];
  const pronounsUsed = subjectOpeners.filter((s) => pronouns.includes(s));
  const hasPronounShift = new Set(pronounsUsed).size > 1;

  return {
    jaccardOverlap: {
      v1v2: j12,
      v1v3: j13,
      v2v3: j23,
      avg: (j12 + j13 + j23) / 3,
    },
    bigramOverlap: {
      v1v2: b12,
      v1v3: b13,
      v2v3: b23,
      avg: (b12 + b13 + b23) / 3,
    },
    uniqueTokens: {
      v1: tokenSets[0].size,
      v2: tokenSets[1].size,
      v3: tokenSets[2].size,
      total: tokenSets[0].size + tokenSets[1].size + tokenSets[2].size,
      uniqueAcrossAll: allTokens.size,
    },
    openingDiversity: {
      sameFirst3Tokens: sameFirst3,
      sameFirstWord: sameFirstWord,
    },
    structuralDiversity: {
      subjectOpeners,
      comparisonMarkers,
      hasPronounShift,
    },
  };
}

// ============================================================================
// Method 1: P1 Literalness Spectrum Prompt
// ============================================================================

function buildMethod1Prompt(input: TestInput): {
  system: string;
  user: string;
} {
  const system = `You are a poetry translation assistant.

Return ONLY valid JSON with exactly 3 translation variants:
{
  "translations": [
    { "variant": 1, "fullText": "...", "words": [], "metadata": { "literalness": 0.9, "characterCount": 0 } },
    { "variant": 2, "fullText": "...", "words": [], "metadata": { "literalness": 0.5, "characterCount": 0 } },
    { "variant": 3, "fullText": "...", "words": [], "metadata": { "literalness": 0.2, "characterCount": 0 } }
  ]
}

CRITICAL: Each variant must be DISTINCTLY different:
- Variant 1: Most literal, faithful to source
- Variant 2: Balanced, natural flow
- Variant 3: Most creative, poetic`;

  const user = `Translate from ${input.sourceLanguage} to ${input.targetLanguage}:

SOURCE LINE: "${input.lineText}"

POEM CONTEXT:
"""
${input.fullPoem}
"""

Generate exactly 3 distinct translation variants.`;

  return { system, user };
}

// ============================================================================
// Method 2: P6-P8 Recipe-Driven Prismatic Prompt
// ============================================================================

function buildMethod2RecipePrompt(input: TestInput): {
  system: string;
  user: string;
} {
  const system = `You are a translation strategy designer. Create three distinct "recipes" for poetry translation.

Return ONLY valid JSON:
{
  "recipes": [
    {
      "label": "A",
      "lens": { "imagery": "preserve", "voice": "preserve", "sound": "adapt", "syntax": "preserve", "cultural": "adapt" },
      "directive": "Stay close to source structure",
      "unusualnessBudget": "low"
    },
    { "label": "B", "lens": {...}, "directive": "...", "unusualnessBudget": "medium" },
    { "label": "C", "lens": {...}, "directive": "...", "unusualnessBudget": "medium" }
  ]
}

LENS OPTIONS:
- imagery: preserve | adapt | substitute | transform
- voice: preserve | shift | collective | intimate
- sound: preserve | adapt | prioritize | ignore
- syntax: preserve | adapt | fragment | invert
- cultural: preserve | adapt | hybrid | localize`;

  const user = `TRANSLATION CONTEXT:
- Source: ${input.sourceLanguage}
- Target: ${input.targetLanguage}

POEM:
"""
${input.fullPoem}
"""

MODE: BALANCED
- Recipe A: low unusualness
- Recipe B: medium unusualness
- Recipe C: medium unusualness

Generate 3 recipes (A, B, C) with different lens configurations.`;

  return { system, user };
}

interface Recipe {
  label: string;
  lens: {
    imagery: string;
    voice: string;
    sound: string;
    syntax: string;
    cultural: string;
  };
  directive: string;
  unusualnessBudget: string;
}

function buildMethod2VariantPrompt(
  input: TestInput,
  recipes: Recipe[]
): { system: string; user: string } {
  const system = `You are a translation variant generator following specific recipes.

Generate 3 distinct translation variants (A, B, C). Each MUST follow its recipe exactly.

CRITICAL RULES:
- Return ONLY valid JSON
- Each variant must be OBSERVABLY DIFFERENT from others
- No two variants may start with the same first 2 non-stopword tokens
- Preserve semantic meaning with DIFFERENT surface realizations

Output format:
{
  "variants": [
    { "label": "A", "translation": "..." },
    { "label": "B", "translation": "..." },
    { "label": "C", "translation": "..." }
  ]
}`;

  const recipeBlock = recipes
    .map(
      (r) => `VARIANT ${r.label}: ${r.directive}
  Lens: imagery=${r.lens.imagery}, voice=${r.lens.voice}, syntax=${r.lens.syntax}
  Unusualness: ${r.unusualnessBudget}`
    )
    .join("\n\n");

  const user = `RECIPES:
${recipeBlock}

SOURCE LINE (${input.sourceLanguage} -> ${input.targetLanguage}):
"${input.lineText}"

POEM CONTEXT:
"""
${input.fullPoem}
"""

Generate 3 variants following the recipes above. Each must be structurally different.`;

  return { system, user };
}

// ============================================================================
// Method Execution
// ============================================================================

async function runMethod1(input: TestInput): Promise<{
  variants: TranslationVariant[];
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  const { system, user } = buildMethod1Prompt(input);

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text) as { translations?: TranslationVariant[] };
    const latencyMs = Date.now() - start;

    if (!parsed.translations || parsed.translations.length < 3) {
      return { variants: [], latencyMs, error: "Insufficient variants" };
    }

    return { variants: parsed.translations.slice(0, 3), latencyMs };
  } catch (error) {
    return {
      variants: [],
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function runMethod2(input: TestInput): Promise<{
  variants: TranslationVariant[];
  latencyMs: number;
  regenCount: number;
  error?: string;
}> {
  const start = Date.now();
  let regenCount = 0;

  try {
    // Step 1: Generate recipes
    const { system: recipeSystem, user: recipeUser } =
      buildMethod2RecipePrompt(input);
    const recipeCompletion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: recipeSystem },
        { role: "user", content: recipeUser },
      ],
    });

    const recipeText = recipeCompletion.choices[0]?.message?.content ?? "{}";
    const recipeParsed = JSON.parse(recipeText) as { recipes?: Recipe[] };

    if (!recipeParsed.recipes || recipeParsed.recipes.length < 3) {
      return {
        variants: [],
        latencyMs: Date.now() - start,
        regenCount: 0,
        error: "Failed to generate recipes",
      };
    }

    // Step 2: Generate variants using recipes
    const { system: variantSystem, user: variantUser } =
      buildMethod2VariantPrompt(input, recipeParsed.recipes);
    const variantCompletion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: variantSystem },
        { role: "user", content: variantUser },
      ],
    });

    const variantText = variantCompletion.choices[0]?.message?.content ?? "{}";
    const variantParsed = JSON.parse(variantText) as {
      variants?: Array<{ label: string; translation: string }>;
    };

    if (!variantParsed.variants || variantParsed.variants.length < 3) {
      return {
        variants: [],
        latencyMs: Date.now() - start,
        regenCount: 0,
        error: "Failed to generate variants",
      };
    }

    // Convert to TranslationVariant format
    const variants: TranslationVariant[] = variantParsed.variants
      .slice(0, 3)
      .map((v, i) => ({
        variant: (i + 1) as 1 | 2 | 3,
        fullText: v.translation,
        words: [],
        metadata: {
          literalness: [0.8, 0.5, 0.3][i],
          characterCount: v.translation.length,
        },
      }));

    // Step 3: Check distinctness (simplified gate)
    const tokenSets = variants.map((v) => tokenizeSet(v.fullText));
    const j12 = jaccardSimilarity(tokenSets[0], tokenSets[1]);
    const j13 = jaccardSimilarity(tokenSets[0], tokenSets[2]);
    const j23 = jaccardSimilarity(tokenSets[1], tokenSets[2]);
    const maxOverlap = Math.max(j12, j13, j23);

    // If distinctness fails (>60% overlap), try regeneration once
    if (maxOverlap > 0.6) {
      regenCount = 1;
      // In real implementation, this would regenerate the worst variant
      // For this evaluation, we just note that regeneration was needed
    }

    return {
      variants,
      latencyMs: Date.now() - start,
      regenCount,
    };
  } catch (error) {
    return {
      variants: [],
      latencyMs: Date.now() - start,
      regenCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Main Evaluation Runner
// ============================================================================

async function evaluateLine(input: TestInput): Promise<EvaluationResult> {
  console.log(
    `\n📝 Evaluating: ${input.id} (${input.sourceLanguage} -> ${input.targetLanguage})`
  );
  console.log(`   Line: "${input.lineText.slice(0, 60)}..."`);

  const [m1Result, m2Result] = await Promise.all([
    runMethod1(input),
    runMethod2(input),
  ]);

  const m1Metrics =
    m1Result.variants.length === 3
      ? computeDiversityMetrics(m1Result.variants)
      : createEmptyMetrics();
  const m2Metrics =
    m2Result.variants.length === 3
      ? computeDiversityMetrics(m2Result.variants)
      : createEmptyMetrics();

  // Compare: Lower overlap = more diverse
  const m1Score = 1 - m1Metrics.jaccardOverlap.avg;
  const m2Score = 1 - m2Metrics.jaccardOverlap.avg;
  const diversityDelta = m2Score - m1Score;

  let verdict: "method2-wins" | "method1-wins" | "tie";
  if (diversityDelta > 0.05) {
    verdict = "method2-wins";
  } else if (diversityDelta < -0.05) {
    verdict = "method1-wins";
  } else {
    verdict = "tie";
  }

  return {
    input,
    method1: {
      variants: m1Result.variants,
      metrics: m1Metrics,
      latencyMs: m1Result.latencyMs,
      error: m1Result.error,
    },
    method2: {
      variants: m2Result.variants,
      metrics: m2Metrics,
      latencyMs: m2Result.latencyMs,
      regenCount: m2Result.regenCount,
      error: m2Result.error,
    },
    comparison: {
      method2MoreDiverse: diversityDelta > 0.05,
      diversityDelta,
      verdict,
    },
  };
}

function createEmptyMetrics(): DiversityMetrics {
  return {
    jaccardOverlap: { v1v2: 1, v1v3: 1, v2v3: 1, avg: 1 },
    bigramOverlap: { v1v2: 1, v1v3: 1, v2v3: 1, avg: 1 },
    uniqueTokens: { v1: 0, v2: 0, v3: 0, total: 0, uniqueAcrossAll: 0 },
    openingDiversity: { sameFirst3Tokens: true, sameFirstWord: true },
    structuralDiversity: {
      subjectOpeners: [],
      comparisonMarkers: [],
      hasPronounShift: false,
    },
  };
}

function printResults(results: EvaluationResult[]): void {
  console.log("\n" + "=".repeat(80));
  console.log("DIVERSITY EVALUATION RESULTS");
  console.log("=".repeat(80));

  // Summary table
  console.log("\n📊 SUMMARY TABLE:\n");
  console.log(
    "| ID        | Cat        | M1 Jaccard | M2 Jaccard | Delta  | Verdict       | M1 Lat | M2 Lat |"
  );
  console.log(
    "|-----------|------------|------------|------------|--------|---------------|--------|--------|"
  );

  let m2Wins = 0;
  let m1Wins = 0;
  let ties = 0;

  for (const r of results) {
    const m1Jacc = r.method1.metrics.jaccardOverlap.avg.toFixed(3);
    const m2Jacc = r.method2.metrics.jaccardOverlap.avg.toFixed(3);
    const delta = r.comparison.diversityDelta.toFixed(3);
    const verdict = r.comparison.verdict;

    if (verdict === "method2-wins") m2Wins++;
    else if (verdict === "method1-wins") m1Wins++;
    else ties++;

    console.log(
      `| ${r.input.id.padEnd(9)} | ${r.input.category.padEnd(
        10
      )} | ${m1Jacc.padStart(10)} | ${m2Jacc.padStart(10)} | ${delta.padStart(
        6
      )} | ${verdict.padEnd(13)} | ${String(r.method1.latencyMs).padStart(
        6
      )}ms | ${String(r.method2.latencyMs).padStart(6)}ms |`
    );
  }

  console.log("\n📈 AGGREGATE STATISTICS:\n");
  const avgM1Jacc =
    results.reduce((s, r) => s + r.method1.metrics.jaccardOverlap.avg, 0) /
    results.length;
  const avgM2Jacc =
    results.reduce((s, r) => s + r.method2.metrics.jaccardOverlap.avg, 0) /
    results.length;
  const avgM1Lat =
    results.reduce((s, r) => s + r.method1.latencyMs, 0) / results.length;
  const avgM2Lat =
    results.reduce((s, r) => s + r.method2.latencyMs, 0) / results.length;

  console.log(
    `   Method 1 avg Jaccard overlap: ${avgM1Jacc.toFixed(
      3
    )} (lower = more diverse)`
  );
  console.log(`   Method 2 avg Jaccard overlap: ${avgM2Jacc.toFixed(3)}`);
  console.log(`   Method 1 avg latency: ${avgM1Lat.toFixed(0)}ms`);
  console.log(
    `   Method 2 avg latency: ${avgM2Lat.toFixed(0)}ms (${(
      (avgM2Lat / avgM1Lat - 1) *
      100
    ).toFixed(0)}% slower)`
  );
  console.log(
    `\n   Wins: Method 2 = ${m2Wins}, Method 1 = ${m1Wins}, Ties = ${ties}`
  );
  console.log(
    `   Method 2 win rate: ${((m2Wins / results.length) * 100).toFixed(1)}%`
  );

  // Detailed examples
  console.log("\n" + "=".repeat(80));
  console.log("DETAILED EXAMPLES (first 3):");
  console.log("=".repeat(80));

  for (const r of results.slice(0, 3)) {
    console.log(`\n📝 ${r.input.id}: "${r.input.lineText.slice(0, 50)}..."`);
    console.log(
      `   (${r.input.sourceLanguage} -> ${r.input.targetLanguage})\n`
    );

    console.log("   METHOD 1 VARIANTS:");
    for (const v of r.method1.variants) {
      console.log(`     ${v.variant}. "${v.fullText}"`);
    }

    console.log("\n   METHOD 2 VARIANTS:");
    for (const v of r.method2.variants) {
      console.log(`     ${v.variant}. "${v.fullText}"`);
    }

    console.log(
      `\n   VERDICT: ${
        r.comparison.verdict
      } (delta: ${r.comparison.diversityDelta.toFixed(3)})`
    );
  }

  // Structural diversity check
  console.log("\n" + "=".repeat(80));
  console.log("STRUCTURAL DIVERSITY ANALYSIS:");
  console.log("=".repeat(80));

  let m1SameOpening = 0;
  let m2SameOpening = 0;
  let m1HasPronounShift = 0;
  let m2HasPronounShift = 0;

  for (const r of results) {
    if (r.method1.metrics.openingDiversity.sameFirst3Tokens) m1SameOpening++;
    if (r.method2.metrics.openingDiversity.sameFirst3Tokens) m2SameOpening++;
    if (r.method1.metrics.structuralDiversity.hasPronounShift)
      m1HasPronounShift++;
    if (r.method2.metrics.structuralDiversity.hasPronounShift)
      m2HasPronounShift++;
  }

  console.log(
    `\n   Same first 3 tokens (bad): M1=${m1SameOpening}/${results.length}, M2=${m2SameOpening}/${results.length}`
  );
  console.log(
    `   Has pronoun shift (good): M1=${m1HasPronounShift}/${results.length}, M2=${m2HasPronounShift}/${results.length}`
  );
}

// ============================================================================
// Entry Point
// ============================================================================

async function main() {
  console.log("🔍 TRANSLATION DIVERSITY INVESTIGATION");
  console.log("=".repeat(80));
  console.log(`Using model: ${MODEL}`);
  console.log(`Test cases: ${TEST_INPUTS.length}`);
  console.log("=".repeat(80));

  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY environment variable required");
    process.exit(1);
  }

  const results: EvaluationResult[] = [];

  // Run evaluations sequentially to avoid rate limits
  for (const input of TEST_INPUTS) {
    const result = await evaluateLine(input);
    results.push(result);
  }

  printResults(results);

  // Export results as JSON for further analysis
  const outputPath = "./scripts/investigation/diversity-results.json";
  const fs = await import("fs");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Full results saved to: ${outputPath}`);
}

main().catch(console.error);
