import { EN_STOPWORDS, pickStopwords } from "@/lib/ai/stopwords";
import { normalizeForContainment, tokenize } from "@/lib/ai/textNormalize";
import type { WordSuggestion } from "./suggestionsSchemas";

const EN_FUNCTION_WORDS = new Set([
  "the",
  "and",
  "of",
  "to",
  "in",
  "with",
  "for",
  "on",
  "at",
  "from",
  "by",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
]);

const META_PATTERNS = [
  /^suggestion/i,
  /^here are/i,
  /^options/i,
  /^word:/i,
  /^output:/i,
  /^example:/i,
];

const MAX_WORDS_DEFAULT = 3;
const MIN_SUGGESTIONS_DEFAULT = 5;
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

export interface GateResult {
  ok: boolean;
  needsRepair: boolean;
  reason?: string;
  suggestions: WordSuggestion[];
  rejectedCount: number;
  leakedEnglishCount: number;
  nonEnglishScriptCount: number;
}

export interface GateOptions {
  maxWords?: number;
  minSuggestions?: number;
  anchorTokens?: Set<string>;
  targetLanguage?: string;
}

function sanitizeSuggestedWord(raw: string): string {
  let word = raw.trim();
  word = word.replace(/^"+/, "").replace(/"+$/, "");
  word = word.replace(/["'’”]+$/, "");
  word = word.replace(/[,，]+$/, "");
  return word.trim();
}

function normalizeWordKey(word: string): string {
  return normalizeForContainment(word);
}

function containsDevanagari(text: string): boolean {
  return DEVANAGARI_REGEX.test(text);
}

export function buildAnchorTokenSet(anchors: string[]): Set<string> {
  const tokens = anchors.flatMap((text) => tokenize(text));
  const filtered = tokens
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 1);
  return new Set(filtered);
}

function hasMetaText(word: string): boolean {
  if (META_PATTERNS.some((pattern) => pattern.test(word))) {
    return true;
  }
  return /[",:;]/.test(word);
}

function isTargetEnglish(targetLanguage?: string): boolean {
  if (!targetLanguage) return false;
  const lower = targetLanguage.toLowerCase().trim();
  return lower === "en" || /\benglish\b/.test(lower);
}

function englishLeakageScore(word: string, targetStopwords?: Set<string>) {
  const tokens = tokenize(word);
  const lowerTokens = tokens.map((t) => t.toLowerCase());
  const englishStopwordCount = lowerTokens.filter((t) =>
    EN_STOPWORDS.has(t)
  ).length;
  const englishFunctionCount = lowerTokens.filter((t) =>
    EN_FUNCTION_WORDS.has(t)
  ).length;
  const targetStopwordCount = targetStopwords
    ? lowerTokens.filter((t) => targetStopwords.has(t)).length
    : 0;

  const looksEnglish =
    (englishStopwordCount >= 3 && targetStopwordCount === 0) ||
    (englishStopwordCount >= 2 && englishFunctionCount >= 1) ||
    (englishFunctionCount >= 2 && targetStopwordCount === 0);

  return {
    tokens,
    englishStopwordCount,
    englishFunctionCount,
    targetStopwordCount,
    looksEnglish,
  };
}

export function runSuggestionsGate(
  rawSuggestions: WordSuggestion[],
  options: GateOptions
): GateResult {
  const maxWords = options.maxWords ?? MAX_WORDS_DEFAULT;
  const minSuggestions = options.minSuggestions ?? MIN_SUGGESTIONS_DEFAULT;
  const anchorTokens = options.anchorTokens ?? new Set<string>();

  const sanitized = rawSuggestions
    .map((s) => ({
      ...s,
      word: sanitizeSuggestedWord(s.word),
      register: (s.register || "neutral").trim(),
      reasoning: (s.reasoning || "").trim(),
      literalness:
        typeof s.literalness === "number" && Number.isFinite(s.literalness)
          ? Math.max(0, Math.min(1, s.literalness))
          : 0.5,
    }))
    .filter((s) => s.word.length > 0);

  const deduped: WordSuggestion[] = [];
  const seen = new Set<string>();
  let rejectedCount = 0;

  for (const suggestion of sanitized) {
    const key = normalizeWordKey(suggestion.word);
    if (!key) {
      rejectedCount++;
      continue;
    }
    if (seen.has(key)) {
      rejectedCount++;
      continue;
    }
    if (anchorTokens.has(key)) {
      rejectedCount++;
      continue;
    }
    if (hasMetaText(suggestion.word)) {
      rejectedCount++;
      continue;
    }
    const wordCount = suggestion.word.split(/\s+/).filter(Boolean).length;
    if (wordCount === 0 || wordCount > maxWords) {
      rejectedCount++;
      continue;
    }
    seen.add(key);
    deduped.push(suggestion);
  }

  const targetLanguage = options.targetLanguage;
  const targetStopwords = targetLanguage
    ? pickStopwords(targetLanguage)
    : undefined;
  const targetIsEnglish = isTargetEnglish(targetLanguage);
  const stopwordSetIsEnglish = targetStopwords === EN_STOPWORDS;
  const stopwordsTrusted = targetStopwords && (!stopwordSetIsEnglish || targetIsEnglish);

  let leakedEnglishCount = 0;
  if (!targetIsEnglish) {
    for (const suggestion of deduped) {
      const leak = englishLeakageScore(
        suggestion.word,
        stopwordsTrusted ? targetStopwords : undefined
      );
      if (leak.looksEnglish) leakedEnglishCount += 1;
    }
  }
  let nonEnglishScriptCount = 0;
  if (targetIsEnglish) {
    for (const suggestion of deduped) {
      if (containsDevanagari(suggestion.word)) {
        nonEnglishScriptCount += 1;
      }
    }
  }

  const leakageThreshold = Math.max(
    2,
    Math.ceil(deduped.length * 0.4)
  );
  const hasEnglishLeakage = !targetIsEnglish && leakedEnglishCount >= leakageThreshold;
  const hasNonEnglishScript = targetIsEnglish && nonEnglishScriptCount > 0;
  const tooFewValid = deduped.length < minSuggestions;
  const rejectedRatio =
    rawSuggestions.length > 0 ? rejectedCount / rawSuggestions.length : 1;

  const needsRepair =
    hasEnglishLeakage || hasNonEnglishScript || tooFewValid || rejectedRatio > 0.5;
  const ok =
    !hasEnglishLeakage && !hasNonEnglishScript && deduped.length >= minSuggestions;

  return {
    ok,
    needsRepair,
    reason: hasNonEnglishScript
      ? "non_english_script"
      : hasEnglishLeakage
      ? "english_leakage"
      : tooFewValid
      ? "too_few_valid"
      : rejectedRatio > 0.5
      ? "too_many_invalid"
      : undefined,
    suggestions: deduped,
    rejectedCount,
    leakedEnglishCount,
    nonEnglishScriptCount,
  };
}
