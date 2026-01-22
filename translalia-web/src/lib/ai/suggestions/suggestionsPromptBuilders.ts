import { buildTranslatorPersonality } from "@/lib/ai/translatorPersonality";
import { tokenize } from "@/lib/ai/textNormalize";
import type {
  LineSuggestionsRequest,
  TokenSuggestionsRequest,
} from "./suggestionsSchemas";

const MAX_EXAMPLE_TOKENS = 20;
const MIN_EXAMPLE_TOKENS = 10;
const MAX_FORBIDDEN_TOKENS = 40;

function collectAnchorTexts(params: {
  targetLineDraft?: string | null;
  variantFullTexts?: { A?: string | null; B?: string | null; C?: string | null } | null;
}): string[] {
  const anchors: string[] = [];
  if (params.targetLineDraft?.trim()) anchors.push(params.targetLineDraft.trim());
  const variants = params.variantFullTexts;
  if (variants?.A?.trim()) anchors.push(variants.A.trim());
  if (variants?.B?.trim()) anchors.push(variants.B.trim());
  if (variants?.C?.trim()) anchors.push(variants.C.trim());
  return anchors;
}

function extractSnippet(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  const take = Math.min(MAX_EXAMPLE_TOKENS, tokens.length);
  return tokens.slice(0, take).join(" ");
}

function buildTargetLanguageExamples(anchors: string[]): string {
  const snippets: string[] = [];
  for (const anchor of anchors) {
    const snippet = extractSnippet(anchor);
    if (!snippet) continue;
    if (!snippets.includes(snippet)) snippets.push(snippet);
    if (snippets.length >= 2) break;
  }

  if (snippets.length === 0) return "";
  return [
    "Target language examples (from active target-language anchors):",
    ...snippets.map((s) => `- "${s}"`),
  ].join("\n");
}

function buildForbiddenTokenList(anchors: string[]): string {
  const tokens = anchors.flatMap((text) => tokenize(text));
  const normalized = tokens
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 1);
  const unique = Array.from(new Set(normalized)).slice(0, MAX_FORBIDDEN_TOKENS);
  if (unique.length === 0) return "";
  return `Do not return exact tokens already present in anchors: ${unique.join(", ")}`;
}

function buildAnchorSection(anchors: {
  targetLineDraft?: string | null;
  variantFullTexts?: { A?: string | null; B?: string | null; C?: string | null } | null;
  selectedVariant?: 1 | 2 | 3 | null;
}): string {
  const selected =
    anchors.selectedVariant === 1
      ? "A"
      : anchors.selectedVariant === 2
      ? "B"
      : anchors.selectedVariant === 3
      ? "C"
      : "none";
  return `
TARGET-LANGUAGE ANCHORS (use these to stay in the target language)
- Draft: "${anchors.targetLineDraft || ""}"
- Variant A: "${anchors.variantFullTexts?.A || ""}"
- Variant B: "${anchors.variantFullTexts?.B || ""}"
- Variant C: "${anchors.variantFullTexts?.C || ""}"
- Selected variant: ${selected}
`.trim();
}

function buildPersonalitySection(guideAnswers: unknown): string {
  const personality = buildTranslatorPersonality(guideAnswers);
  return `
TRANSLATOR PERSONALITY
- Domain: ${personality.domain}
- Purpose: ${personality.purpose}
- Priority: ${personality.priority}
- Source language variety: ${personality.source_language_variety ?? "not specified"}
`.trim();
}

function markTokenInText(text: string, position?: number | null): string {
  if (!text || position === null || position === undefined) return text;
  const tokens = text.split(/\s+/);
  if (position < 0 || position >= tokens.length) return text;
  const marked = tokens.map((t, idx) =>
    idx === position ? `[[${t}]]` : t
  );
  return marked.join(" ");
}

function buildTargetLanguageGuardrails(targetLanguage: string): string {
  const lower = targetLanguage.toLowerCase();
  if (lower === "en" || /\benglish\b/.test(lower)) {
    return "If the target language is English, use English words in Latin script only. Do not use Devanagari or Hindi words.";
  }
  return "";
}

export function buildLineSuggestionsPrompt(params: {
  request: LineSuggestionsRequest;
  guideAnswers: unknown;
  targetLanguage: string;
  sourceLanguage: string;
}): { system: string; user: string } {
  const { request, guideAnswers, targetLanguage, sourceLanguage } = params;
  const anchors = collectAnchorTexts({
    targetLineDraft: request.targetLineDraft,
    variantFullTexts: request.variantFullTexts,
  });
  const targetExamples = buildTargetLanguageExamples(anchors);
  const forbiddenTokens = buildForbiddenTokenList(anchors);
  const personalitySection = buildPersonalitySection(guideAnswers);
  const guardrails = buildTargetLanguageGuardrails(targetLanguage);

  const system = `
You are a poetry translation assistant generating word suggestions.

CRITICAL LANGUAGE CONTRACT:
- All "word" fields MUST be written in ${targetLanguage}
- If you output English or any other language in "word", the output is INVALID
- Return ONLY valid JSON with the exact shape requested
${guardrails ? `- ${guardrails}` : ""}
`.trim();

  const user = `
${personalitySection}

SOURCE LINE (${sourceLanguage}):
"${request.currentLine}"

CONTEXT LINES:
${request.previousLine ? `Prev: "${request.previousLine}"` : "Prev: (none)"}
${request.nextLine ? `Next: "${request.nextLine}"` : "Next: (none)"}

${buildAnchorSection({
  targetLineDraft: request.targetLineDraft,
  variantFullTexts: request.variantFullTexts,
  selectedVariant: request.selectedVariant,
})}

${targetExamples}
${forbiddenTokens}

TASK:
Generate 9 suggestions total, split evenly by archetype.
- 3 suggestions with fitsWith = "A"
- 3 suggestions with fitsWith = "B"
- 3 suggestions with fitsWith = "C"

Constraints:
- Suggestions must fit the local line context and translator personality.
- Suggestions must be 1-3 words max.
- Use: replace | insert | opening | closing (pick the best use per suggestion).

Output JSON only:
{
  "suggestions": [
    {
      "word": "…",
      "use": "replace",
      "fitsWith": "A",
      "register": "poetic|neutral|colloquial|archaic|…",
      "literalness": 0.0-1.0,
      "reasoning": "optional short reason"
    }
  ]
}
`.trim();

  return { system, user };
}

export function buildTokenSuggestionsPrompt(params: {
  request: TokenSuggestionsRequest;
  guideAnswers: unknown;
  targetLanguage: string;
  sourceLanguage: string;
}): { system: string; user: string } {
  const { request, guideAnswers, targetLanguage, sourceLanguage } = params;
  const anchors = collectAnchorTexts({
    targetLineDraft: request.targetLineDraft,
    variantFullTexts: request.variantFullTexts,
  });
  const targetExamples = buildTargetLanguageExamples(anchors);
  const forbiddenTokens = buildForbiddenTokenList(anchors);
  const personalitySection = buildPersonalitySection(guideAnswers);
  const guardrails = buildTargetLanguageGuardrails(targetLanguage);

  const focus = request.focus;
  const sourceLineMarked =
    focus.sourceType === "source"
      ? markTokenInText(request.sourceLine, focus.position)
      : request.sourceLine;
  const draftMarked =
    focus.sourceType === "variant" && request.targetLineDraft
      ? markTokenInText(request.targetLineDraft, focus.position)
      : request.targetLineDraft || "";
  const extraHints = (request.extraHints || [])
    .map((hint) => hint.trim())
    .filter(Boolean);
  const extraHintsSection =
    extraHints.length > 0
      ? [
          "EXTRA HINTS (from the student):",
          ...extraHints.map((hint) => `- ${hint}`),
        ].join("\n")
      : "";
  const suggestionRangeMode = request.suggestionRangeMode ?? "balanced";
  const rangeGuidance =
    suggestionRangeMode === "focused"
      ? "Keep suggestions close to the original meaning and tone."
      : suggestionRangeMode === "adventurous"
      ? "Offer more surprising, creative, and playful word choices."
      : "Mix safe choices with a few fresh, creative options.";

  const system = `
You are a poetry translation assistant generating token-level suggestions.

CRITICAL LANGUAGE CONTRACT:
- All "word" fields MUST be written in ${targetLanguage}
- If you output English or any other language in "word", the output is INVALID
- Return ONLY valid JSON with the exact shape requested
${guardrails ? `- ${guardrails}` : ""}
`.trim();

  const user = `
${personalitySection}

FOCUS TOKEN:
- word: "${focus.word}"
- originalWord: "${focus.originalWord || ""}"
- partOfSpeech: "${focus.partOfSpeech || "unknown"}"
- position: ${focus.position ?? "unknown"}
- sourceType: ${focus.sourceType}
- variantId: ${focus.variantId ?? "n/a"}

SOURCE LINE (${sourceLanguage}):
"${sourceLineMarked}"

TARGET-LANGUAGE ANCHORS:
${buildAnchorSection({
  targetLineDraft: draftMarked,
  variantFullTexts: request.variantFullTexts,
  selectedVariant: request.selectedVariant,
})}

${targetExamples}
${forbiddenTokens}
${extraHintsSection}
SUGGESTION RANGE:
${rangeGuidance}

TASK:
Generate 7-9 token suggestions that could replace or complement the focus token.
Tag each suggestion with fitsWith ("A" | "B" | "C" | "any").

Constraints:
- Suggestions must be 1-3 words max.
- Respect part of speech and nearby context when possible.

Output JSON only:
{
  "suggestions": [
    {
      "word": "…",
      "use": "replace",
      "fitsWith": "any",
      "register": "poetic|neutral|colloquial|archaic|…",
      "literalness": 0.0-1.0,
      "reasoning": "optional short reason"
    }
  ]
}
`.trim();

  return { system, user };
}
