import { GuideAnswers } from "@/store/guideSlice";
import { DragData } from "@/types/drag";
import {
  buildTranslatorPersonality,
  buildVariantDefinitions,
  buildDomainExamples,
  type TranslatorPersonality,
} from "./translatorPersonality";

const LINE_CLOSENESS_DESCRIPTIONS = {
  close: "Stay as close as possible to the literal meaning",
  in_between: "Balance literal accuracy with natural expression",
  natural: "Prioritize natural, idiomatic expression",
} as const;

function collectPreferenceLines(
  guideAnswers: GuideAnswers,
  mode: "line"
): string[] {
  const lines: string[] = [];

  // NEW: Support both translationZone and translationIntent
  // translationZone = broader context/zone for translation
  // translationIntent = specific translation strategy/approach
  const translationZone = guideAnswers.translationZone?.trim();
  const translationIntent = guideAnswers.translationIntent?.trim();

  // Add zone first (broader context)
  if (translationZone) {
    lines.push(`Translation zone: ${translationZone}`);
  }

  // Add intent second (specific strategy)
  if (translationIntent) {
    lines.push(`Translation strategy: ${translationIntent}`);
  }

  // Legacy support: if no zone/intent, use target language info
  if (!translationZone && !translationIntent) {
    const targetLanguage = guideAnswers.targetLanguage?.lang?.trim();
    const targetVariety = guideAnswers.targetLanguage?.variety?.trim();
    if (targetLanguage) {
      lines.push(
        `Target language: ${targetLanguage}${
          targetVariety ? ` (${targetVariety} variety)` : ""
        }`
      );
    }
  }

  const vibes = guideAnswers.style?.vibes?.filter(Boolean) ?? [];
  if (vibes.length > 0) {
    lines.push(`Style preferences: ${vibes.join(", ")}`);
  }

  const closeness = guideAnswers.stance?.closeness;
  if (closeness) {
    const description = LINE_CLOSENESS_DESCRIPTIONS[closeness];
    lines.push(`Translation approach: ${description}`);
  }

  const mustKeep = guideAnswers.policy?.must_keep?.filter(Boolean) ?? [];
  if (mustKeep.length > 0) {
    lines.push(`Must preserve: ${mustKeep.join(", ")}`);
  }

  const noGo = guideAnswers.policy?.no_go?.filter(Boolean) ?? [];
  if (noGo.length > 0) {
    lines.push(`Avoid: ${noGo.join(", ")}`);
  }

  const formDetails = [
    guideAnswers.form?.line_breaks?.trim() &&
      `Line breaks: ${guideAnswers.form?.line_breaks}`,
    guideAnswers.form?.rhyme?.trim() && `Rhyme: ${guideAnswers.form?.rhyme}`,
    guideAnswers.form?.line_length?.trim() &&
      `Line length: ${guideAnswers.form?.line_length}`,
  ]
    .filter(Boolean)
    .join("; ");
  if (formDetails) {
    lines.push(`Form guidance: ${formDetails}`);
  }

  if (guideAnswers.style_anchors?.length) {
    lines.push(`Style anchors: ${guideAnswers.style_anchors.join(", ")}`);
  }

  if (!closeness) {
    lines.push(
      "Translation approach: Balance literal accuracy with natural expression"
    );
  }

  return lines;
}

function formatPreferenceSection(
  guideAnswers: GuideAnswers,
  mode: "line"
): string {
  const lines = collectPreferenceLines(guideAnswers, mode);
  if (lines.length === 0) {
    return "- No specific instructions provided.";
  }
  return lines.map((line) => `- ${line}`).join("\n");
}

export interface AIAssistContext {
  selectedWords: DragData[];
  sourceLineText: string;
  guideAnswers: GuideAnswers;
  instruction?: "refine" | "rephrase" | "expand" | "simplify";
}

export interface LineTranslationContext {
  lineText: string;
  lineIndex: number; // 0-indexed line number in the poem
  fullPoem?: string;
  stanzaIndex?: number;
  prevLine?: string;
  nextLine?: string;
  guideAnswers: GuideAnswers;
  sourceLanguage?: string;
}

/**
 * Builds a GPT prompt for AI-assisted translation refinement.
 * Takes user's selected words and helps refine them into a natural, poetic line.
 */
export function buildAIAssistPrompt({
  selectedWords,
  sourceLineText,
  guideAnswers,
  instruction = "refine",
}: AIAssistContext): string {
  const translationIntent = guideAnswers.translationIntent?.trim();
  const targetLanguage = guideAnswers.targetLanguage?.lang?.trim();
  const targetVariety = guideAnswers.targetLanguage?.variety?.trim();
  const targetDescriptor = targetLanguage
    ? `${targetLanguage}${targetVariety ? ` (${targetVariety} variety)` : ""}`
    : translationIntent
    ? "the language specified in the translator instructions"
    : "the target language";

  const preferenceSection = formatPreferenceSection(guideAnswers, "line");
  const closenessKey = guideAnswers.stance?.closeness || "in_between";
  const closenessSummary = LINE_CLOSENESS_DESCRIPTIONS[closenessKey];

  // Current words assembled
  const currentTranslation = selectedWords.map((w) => w.text).join(" ");
  const originalWords = selectedWords.map((w) => w.originalWord).join(" ");

  // Instruction mapping
  const instructionMap = {
    refine: "Refine and polish the translation while keeping the core meaning",
    rephrase: "Rephrase for better flow and naturalness",
    expand: "Expand slightly for clarity or poetic effect",
    simplify: "Simplify for directness and clarity",
  };

  return `You are assisting a poetry translator working in ${targetDescriptor}. They have selected individual words and need help combining them into a natural, poetic line.

SOURCE LINE: "${sourceLineText}"
ORIGINAL WORDS: "${originalWords}"

TRANSLATOR'S WORD CHOICES: "${currentTranslation}"

TRANSLATOR PREFERENCES:
${preferenceSection}

Overall translation approach: ${closenessSummary}

TASK: ${instructionMap[instruction]}

CONSTRAINTS:
1. Use the translator's selected words as the foundation
2. Make MINIMAL changes - respect their choices
3. Adjust word order, articles, connectors ONLY if needed
4. Maintain poetic quality and natural flow
5. Stay true to the source meaning
6. Match the translator instructions above (language, tone, constraints)

Provide:
1. A refined translation (single line)
2. A brief explanation of any changes made
3. 2-3 alternative phrasings (optional)

Return ONLY a JSON object:
{
  "suggestion": "the refined translation",
  "confidence": 85,
  "reasoning": "brief explanation",
  "alternatives": ["alt1", "alt2"]
}`;
}

/**
 * Builds a system prompt for AI assist refinement.
 */
export function buildAIAssistSystemPrompt(): string {
  return `You are a poetry translation assistant specializing in refining and polishing translations.

IMPORTANT RULES:
- Return ONLY valid JSON
- Respect the translator's word choices
- Make MINIMAL changes
- Focus on natural flow and poetic quality
- Confidence score: 0-100 based on how natural/accurate the suggestion is
- Reasoning: Explain what was changed and why (1 sentence)
- Alternatives: Provide 2-3 variations if useful

WHAT TO ADJUST:
✓ Word order for natural flow
✓ Articles (a, an, the) for grammar
✓ Connectors (and, but, or) for flow
✓ Punctuation for rhythm

WHAT NOT TO CHANGE:
✗ Core vocabulary chosen by translator
✗ Meaning or tone of the line
✗ Replace words with synonyms unnecessarily

Example valid response:
{
  "suggestion": "love and life and beauty bright",
  "confidence": 92,
  "reasoning": "Added conjunction for flow, adjusted word order",
  "alternatives": ["love, life, beauty bright", "bright love and life and beauty"]
}`;
}

/**
 * Builds a prompt for generating brief, warm feedback on student's translation journey.
 * Returns 1-2 short paragraphs (~100-150 words) focusing on the student's creative choices
 * and thinking process, NOT on translation quality assessment.
 *
 * For ages 12-16. Tone should be warm, encouraging, peer-like.
 * Target: students who may be intimidated by assessment-style feedback.
 */
export interface JourneyFeedbackContext {
  studentReflection: string;
  completedLines: Record<string, string>; // index => translation
  poemLines: string[];
  completedCount: number;
  totalCount: number;
}

export function buildJourneyFeedbackPrompt({
  studentReflection,
  completedLines,
  poemLines,
  completedCount,
  totalCount,
}: JourneyFeedbackContext): string {
  // Format the completed translations with their source lines
  const completedTranslations = Object.entries(completedLines)
    .map(([idx, translation]) => {
      const lineNum = parseInt(idx);
      const sourceLine = poemLines[lineNum] || "";
      return `Line ${lineNum + 1}: "${sourceLine}" → "${translation}"`;
    })
    .join("\n");

  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return `You are a warm, encouraging translation companion providing brief, conversational feedback to a young translator (ages 12-16).

STUDENT'S REFLECTION ABOUT THEIR JOURNEY:
"${studentReflection}"

THEIR TRANSLATION PROGRESS:
${completedCount}/${totalCount} lines (${progressPercent}%)

THEIR COMPLETED LINES:
${completedTranslations}

YOUR TASK:
Write 1-2 short paragraphs (~100-150 words total) responding to their reflection and journey.

TONE & APPROACH:
- Warm, friendly, like a peer or mentor
- Celebrate their thinking process and creative choices
- Acknowledge specific lines they translated (cite actual lines, not line numbers)
- Ask implicit questions that encourage reflection
- Focus on growth and learning, not judgment
- Use conversational phrases: "I noticed...", "That's cool because...", "You're thinking like..."
- End on encouragement

CRITICAL - DO NOT:
- Use words: "assessment", "strengths", "weaknesses", "evaluation", "score", "grade"
- Write like a teacher grading
- Focus on "correctness" vs source language
- Be condescending or overly formal
- Make it about performance - make it about thinking and creativity

CRITICAL - DO:
- Mention specific lines/translations they created
- Celebrate their creative decision-making
- Show genuine interest in their process
- Encourage continued exploration
- Use 1-2 friendly emojis max (🌟 ✨ 🎉)

Example good response:
"I loved how you kept the rhythm in 'Luna danza sola' - that's actually one of the hardest parts of poetry translation! You're not just swapping words, you're thinking about how they sound together. The way you explored different options for that line tells me you understand what real translation is about. Keep that curiosity going! 🌟"

Return the feedback as plain text (no JSON, no markdown, just the paragraphs).`;
}

/**
 * System prompt for journey feedback generation.
 */
export function buildJourneyFeedbackSystemPrompt(): string {
  return `You are a warm, encouraging translation companion for young translators (ages 12-16).

Your job is to provide brief, conversational feedback on their translation journey.

TONE:
- Warm and genuine
- Conversational ("I noticed...", "That's cool because...")
- Like a peer or supportive mentor
- Never condescending or overly formal

LENGTH:
- Exactly 1-2 short paragraphs
- Target: 100-150 words
- Concise, digestible, engaging

FOCUS:
- Their creative thinking process
- Specific lines they translated (mention actual lines)
- Why their approach matters
- Growth and learning
- Encouragement for future translation

AVOID:
- Assessment language (no "strengths", "weaknesses", "evaluation")
- Teacher-like grading tone
- Focusing on "correctness"
- Generic comments
- Overexplaining

EMOJI USE:
- Max 1-2 friendly emojis (🌟 ✨ 🎉)
- Use sparingly, only if natural

Return ONLY the feedback text - no JSON, no markdown, no explanations.`;
}

/**
 * Builds a GPT prompt for generating line-level translations with alignment.
 * Generates exactly 3 translation variants with sub-token alignment.
 *
 * Structure follows the requirement:
 * - STATIC SECTION: Full poem + guide preferences (same for whole session)
 * - DYNAMIC SECTION: Line-specific context (changes per line)
 */
export function buildLineTranslationPrompt(params: {
  lineText: string;
  lineIndex: number;
  prevLine?: string | null;
  nextLine?: string | null;
  fullPoem: string;
  stanzaIndex?: number;
  position?: { isFirst: boolean; isLast: boolean; isOnly: boolean };
  guideAnswers: GuideAnswers;
  sourceLanguage: string;
  targetLanguage: string;
}): { system: string; user: string } {
  const {
    lineText,
    lineIndex,
    prevLine,
    nextLine,
    fullPoem,
    stanzaIndex,
    position = { isFirst: false, isLast: false, isOnly: false },
    guideAnswers,
    sourceLanguage,
    targetLanguage,
  } = params;

  const personality = buildTranslatorPersonality(guideAnswers);

  const system = `
You are a specialized poetry translation assistant with a specific translator personality.

IMPORTANT:
- Return ONLY a valid JSON object (no markdown, no explanations)
- Use the exact output shape requested (key: "translations")
- Generate exactly 3 DISTINCT variants (1, 2, 3)
- ALL variants must honor the translator personality

Any non-JSON content will cause parsing errors.
`.trim();

  const user = buildLineTranslationUserPrompt({
    lineText,
    lineIndex,
    prevLine,
    nextLine,
    fullPoem,
    stanzaIndex,
    position,
    personality,
    sourceLanguage,
    targetLanguage,
  });

  return { system, user };
}

function buildLineTranslationUserPrompt(params: {
  lineText: string;
  lineIndex: number;
  prevLine?: string | null;
  nextLine?: string | null;
  fullPoem: string;
  stanzaIndex?: number;
  position: { isFirst: boolean; isLast: boolean; isOnly: boolean };
  personality: TranslatorPersonality;
  sourceLanguage: string;
  targetLanguage: string;
}): string {
  const {
    lineText,
    lineIndex,
    prevLine,
    nextLine,
    fullPoem,
    stanzaIndex,
    position,
    personality,
    sourceLanguage,
    targetLanguage,
  } = params;

  const sections: string[] = [];
  sections.push(buildPersonalitySection(personality));
  sections.push(
    buildContextSection({
      lineText,
      lineIndex,
      prevLine,
      nextLine,
      fullPoem,
      stanzaIndex,
      position,
    })
  );
  sections.push(buildVariantDefinitions(personality));
  sections.push(
    buildDomainExamples(personality, sourceLanguage, targetLanguage)
  );
  sections.push(
    buildTaskInstructions({
      lineText,
      sourceLanguage,
      targetLanguage,
      personality,
    })
  );

  return sections.join("\n\n");
}

function buildPersonalitySection(personality: TranslatorPersonality): string {
  const {
    domain,
    purpose,
    literalness,
    register,
    sacred_terms,
    forbidden_terms,
    approach_summary,
    creativity_level,
    priority,
    source_language_variety,
    source_language_notes,
  } = personality;

  const sacred =
    sacred_terms.length > 0
      ? `SACRED TERMS (use these when possible):\n${sacred_terms
          .map((t) => `✓ \"${t}\"`)
          .join("\n")}`
      : "";
  const forbidden =
    forbidden_terms.length > 0
      ? `FORBIDDEN TERMS (NEVER use):\n${forbidden_terms
          .map((t) => `✗ \"${t}\"`)
          .join("\n")}`
      : "";

  const sourceContext =
    source_language_variety && source_language_variety.trim().length > 0
      ? `
SOURCE LANGUAGE CONTEXT:
${source_language_notes ?? "Source language variety provided by user."}

⚠️ IMPORTANT: The source text is in ${source_language_variety}.
- Be aware of dialect-/variety-specific expressions and idioms
- Don't mistake regional usage for errors
- Preserve cultural/regional flavor where appropriate
- If unsure about a phrase, consider it may be variety-specific
`.trim()
      : "";

  return `
═══════════════════════════════════════════════════════════════
TRANSLATOR PERSONALITY (Your Identity)
═══════════════════════════════════════════════════════════════
This personality defines EVERY decision you make. All variants must reflect it.

Domain: ${domain}
Purpose: ${purpose}
Approach: ${approach_summary}

Literalness: ${literalness}/100 ${
    literalness >= 70
      ? "(Stay very close to source)"
      : literalness >= 40
      ? "(Balance source and target)"
      : "(Prioritize target language naturalness)"
  }
Register: ${register.length > 0 ? register.join(", ") : "neutral"}
Priority: ${priority}
Creativity Level: ${creativity_level}

${sourceContext}

${sacred}
${forbidden}

Remember: This personality is NON-NEGOTIABLE. Every variant must embody it.
`.trim();
}

function buildContextSection(params: {
  lineText: string;
  lineIndex: number;
  prevLine?: string | null;
  nextLine?: string | null;
  fullPoem: string;
  stanzaIndex?: number;
  position: { isFirst: boolean; isLast: boolean; isOnly: boolean };
}): string {
  const {
    lineText,
    lineIndex,
    prevLine,
    nextLine,
    fullPoem,
    stanzaIndex,
    position,
  } = params;

  const lineNumber = lineIndex + 1;
  const chunkNumber = typeof stanzaIndex === "number" ? stanzaIndex + 1 : null;

  const positionNote = position.isOnly
    ? "📍 Position: COMPLETE SINGLE-LINE POEM — make it impactful and complete in itself."
    : position.isFirst
    ? "📍 Position: OPENING LINE — set the tone. No previous line to match."
    : position.isLast
    ? "📍 Position: CLOSING LINE — bring closure and finality."
    : `📍 Position: Line ${lineNumber} — maintain flow across lines.`;

  return `
═══════════════════════════════════════════════════════════════
POEM CONTEXT
═══════════════════════════════════════════════════════════════
${positionNote}

${chunkNumber ? `Chunk: ${chunkNumber}` : ""}
${prevLine ? `Previous line: \"${prevLine}\"` : ""}
Current line (TO TRANSLATE): \"${lineText}\"
${nextLine ? `Next line: \"${nextLine}\"` : ""}

Full Poem:
\"\"\"
${fullPoem}
\"\"\"
`.trim();
}

function buildTaskInstructions(params: {
  lineText: string;
  sourceLanguage: string;
  targetLanguage: string;
  personality: TranslatorPersonality;
}): string {
  const { lineText, sourceLanguage, targetLanguage, personality } = params;

  return `
═══════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════
Translate from ${sourceLanguage} to ${targetLanguage}:
\"${lineText}\"

CRITICAL REQUIREMENTS:
- Generate exactly 3 variants (variant 1, 2, 3)
- Each variant must be DISTINCTLY different (not minor word swaps)
- ALL variants must honor the translator personality (domain: ${personality.domain})
- Include word-level alignment for each variant (\"words\" array)
- Provide metadata for each variant (literalness 0-1, characterCount, preservesRhyme?, preservesMeter?)

OUTPUT FORMAT
Return ONLY this JSON structure:
{
  \"translations\": [
    {
      \"variant\": 1,
      \"fullText\": \"complete translated line\",
      \"words\": [
        {
          \"original\": \"source word or phrase\",
          \"translation\": \"target word or phrase\",
          \"position\": 0,
          \"partOfSpeech\": \"noun|verb|adjective|adverb|pronoun|preposition|conjunction|article|interjection|neutral\"
        }
      ],
      \"metadata\": {
        \"literalness\": 0.95,
        \"characterCount\": 31,
        \"preservesRhyme\": false,
        \"preservesMeter\": false
      }
    },
    { \"variant\": 2, \"fullText\": \"...\", \"words\": [], \"metadata\": { \"literalness\": 0.5, \"characterCount\": 0 } },
    { \"variant\": 3, \"fullText\": \"...\", \"words\": [], \"metadata\": { \"literalness\": 0.2, \"characterCount\": 0 } }
  ]
}
`.trim();
}

/**
 * Builds a system prompt for line-level translation with alignment.
 */
export function buildLineTranslationSystemPrompt(): string {
  return `You are a poetry translation assistant specializing in line-level translations with accurate alignment.

IMPORTANT RULES:
- Return ONLY a valid JSON object with the exact structure specified
- Generate exactly 3 translation variants
- Each variant must include complete alignment mapping
- Handle multi-word chunks correctly (e.g., "sat on" → "se sentó en")
- Every original word/phrase must be mapped in the alignment
- Position numbers are 0-indexed and reflect order in original line
- Metadata must be accurate (literalness 0-1, characterCount, preservesRhyme, preservesMeter)

ALIGNMENT ACCURACY:
- Sub-token alignment is critical: map original words/phrases to their translations
- Multi-word chunks: "sat on" can map to "se sentó en" (many-to-many is allowed)
- Single words can map to phrases: "cat" → "el gato"
- Phrases can map to single words: "the cat" → "gato" (if appropriate)
- Ensure all original words are accounted for in the alignment

VARIANT DIVERSITY:
- Variant 1: More literal (higher literalness score)
- Variant 2: Balanced (medium literalness)
- Variant 3: More creative (lower literalness, more idiomatic)

METADATA CALCULATION:
- literalness: 1.0 = word-for-word literal, 0.0 = highly creative/idiomatic
- characterCount: Exact character count of fullText
- preservesRhyme: true if end rhyme matches adjacent lines (if applicable)
- preservesMeter: true if syllable count/stress pattern matches (if applicable)

Example valid response structure:
{
  "translations": [
    {
      "variant": 1,
      "fullText": "El gato se sentó en la alfombra",
      "words": [
        { "original": "The", "translation": "El", "partOfSpeech": "article", "position": 0 },
        { "original": "cat", "translation": "gato", "partOfSpeech": "noun", "position": 1 },
        { "original": "sat on", "translation": "se sentó en", "partOfSpeech": "verb", "position": 2 },
        { "original": "the", "translation": "la", "partOfSpeech": "article", "position": 3 },
        { "original": "mat", "translation": "alfombra", "partOfSpeech": "noun", "position": 4 }
      ],
      "metadata": {
        "literalness": 0.85,
        "characterCount": 31,
        "preservesRhyme": false,
        "preservesMeter": true
      }
    }
  ]
}`;
}

/**
 * Feature 9 (R): Fallback prompt for simpler word-by-word translation
 * Used when alignment fails after retries
 * Returns basic translations without word-level alignment
 */
export function buildLineTranslationFallbackPrompt({
  lineText,
  lineIndex,
  fullPoem,
  stanzaIndex,
  guideAnswers,
  sourceLanguage = "the source language",
}: LineTranslationContext): string {
  const closenessKey = guideAnswers.stance?.closeness || "in_between";
  const closenessSummary = LINE_CLOSENESS_DESCRIPTIONS[closenessKey];
  const preferenceSection = formatPreferenceSection(guideAnswers, "line");

  const lineNumber = lineIndex + 1;
  const stanzaNumber = stanzaIndex !== undefined ? stanzaIndex + 1 : undefined;

  return `You are translating a poem from \${sourceLanguage}.

Translation preferences:
\${preferenceSection}

Focus on this specific line:
\${stanzaNumber ? \`- Stanza \${stanzaNumber}, Line \${lineNumber}\` : \`- Line \${lineNumber}\`}: "\${lineText}"

TASK:
Generate exactly 3 simple translation variants for this line. This is a SIMPLIFIED translation request:
1. Honor the translator instructions above
2. Fit naturally within the poetic context
3. Span from literal to more creative interpretations (\${closenessSummary})

NOTE: This is a simplified translation without detailed alignment.
Just provide the full translated text for each variant.

Return ONLY a JSON object with this exact structure:
{
  "translations": [
    {
      "variant": 1,
      "fullText": "complete translated line - literal version",
      "words": [],
      "metadata": {
        "literalness": 0.9,
        "characterCount": 35,
        "preservesRhyme": false,
        "preservesMeter": false
      }
    },
    {
      "variant": 2,
      "fullText": "complete translated line - balanced version",
      "words": [],
      "metadata": {
        "literalness": 0.5,
        "characterCount": 30,
        "preservesRhyme": false,
        "preservesMeter": false
      }
    },
    {
      "variant": 3,
      "fullText": "complete translated line - creative version",
      "words": [],
      "metadata": {
        "literalness": 0.2,
        "characterCount": 28,
        "preservesRhyme": false,
        "preservesMeter": false
      }
    }
  ]
}`;
}

/**
 * Feature 9 (R): System prompt for fallback translation
 */
export function buildLineTranslationFallbackSystemPrompt(): string {
  return `You are a poetry translation assistant providing SIMPLIFIED translations.

IMPORTANT RULES:
- Return ONLY a valid JSON object with the translations array
- Generate exactly 3 translation variants
- Each variant should be a complete translated line
- Words array should be EMPTY (this is simplified translation)
- Metadata can be estimated (no word-level accuracy required)
- Focus on providing natural, readable translations

This is a fallback mode used when alignment-based translation fails.
Priority is on providing usable translations quickly, not perfect alignment.`;
}

/**
 * Build prompt for generating additional word suggestions.
 * Highly context-aware: considers neighboring lines, poem theme, and flow.
 */
export function buildAdditionalWordSuggestionsPrompt(params: {
  currentLine: string;
  lineIndex: number;
  previousLine?: string | null;
  nextLine?: string | null;
  fullPoem: string;
  poemTheme?: string;
  guideAnswers: unknown;
  userGuidance?: string | null; // For regeneration
  targetLanguage: string;
  sourceLanguage: string;
}): { system: string; user: string } {
  const {
    currentLine,
    lineIndex,
    previousLine,
    nextLine,
    fullPoem,
    poemTheme,
    guideAnswers,
    userGuidance,
    targetLanguage,
    sourceLanguage,
  } = params;

  const personality = buildTranslatorPersonality(guideAnswers);

  const systemPrompt = `
You are a specialized poetry translation assistant generating additional word alternatives.

Your task: Provide 7-9 diverse, contextually-appropriate word suggestions for a specific line in a poem translation.

CRITICAL RULES:
- Consider the FULL POEM context
- Pay special attention to neighboring lines (previous and next) for flow and rhyme
- Respect the translator personality (domain, register, style)
- Generate words that fit the line's meaning and position in the poem
- Provide variety: different registers, synonyms, metaphors
- Return ONLY JSON format (no markdown, no explanations)
  `.trim();

  const userPrompt = `
═══════════════════════════════════════════════════════════════
TRANSLATOR PERSONALITY
═══════════════════════════════════════════════════════════════

${personality.approach_summary}

Domain: ${personality.domain}
Register: ${personality.register.join(", ") || "neutral"}
Priority: ${personality.priority}
Literalness: ${personality.literalness}/100

${
  personality.sacred_terms.length > 0
    ? `\nPreferred terms: ${personality.sacred_terms.join(", ")}`
    : ""
}
${
  personality.forbidden_terms.length > 0
    ? `\nAvoid: ${personality.forbidden_terms.join(", ")}`
    : ""
}

═══════════════════════════════════════════════════════════════
POEM CONTEXT
═══════════════════════════════════════════════════════════════

Full Poem (${sourceLanguage}):
"""
${fullPoem}
"""

${poemTheme ? `\nPoem Theme: ${poemTheme}` : ""}

═══════════════════════════════════════════════════════════════
CURRENT LINE FOCUS
═══════════════════════════════════════════════════════════════

Line ${lineIndex + 1}: "${currentLine}"

${
  previousLine
    ? `
Previous Line (for flow/rhyme): "${previousLine}"
→ Consider how your suggestions connect to this line
`
    : lineIndex === 0
    ? "→ This is the OPENING LINE - set the tone"
    : ""
}

${
  nextLine
    ? `
Next Line (for flow/rhyme): "${nextLine}"
→ Consider how your suggestions lead into this line
`
    : ""
}

═══════════════════════════════════════════════════════════════
TASK: GENERATE 7-9 WORD SUGGESTIONS
═══════════════════════════════════════════════════════════════

Generate 7-9 diverse word alternatives in ${targetLanguage} for this line.

${
  userGuidance
    ? `
⚠️ USER'S SPECIFIC GUIDANCE:
"${userGuidance}"

Incorporate this guidance into your suggestions.
`
    : ""
}

REQUIREMENTS:
1. Each word must fit naturally in the line's context
2. Consider rhyme/meter with neighboring lines
3. Vary the suggestions:
   - Include both literal and metaphorical options
   - Mix registers (formal/informal) within personality bounds
   - Provide synonyms with different connotations
4. Honor the translator personality above
5. Each word should be a single token or short phrase (max 3 words)

OUTPUT FORMAT (JSON only):
{
  "suggestions": [
    {
      "word": "palabra",
      "reasoning": "Literal translation, neutral register",
      "register": "neutral",
      "literalness": 0.9
    }
  ]
}

CRITICAL: Return ONLY valid JSON. No preamble, no markdown, no explanations outside JSON.
  `.trim();

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}

// =============================================================================
// Recipe-Aware Prismatic Prompt Builders
// =============================================================================

import type { VariantRecipe, VariantRecipesBundle } from "./variantRecipes";

/**
 * Build a prompt block that describes the variant recipes.
 * Includes inline meaning anchor instruction (no heuristic extraction).
 * Mode-aware comparison strategy enforcement.
 */
export function buildRecipePromptBlock(
  recipes: VariantRecipe[],
  sourceText: string,
  mode?: "focused" | "balanced" | "adventurous"
): string {
  const recipeBlocks = recipes
    .map(
      (r) => `
VARIANT ${r.label}: ${r.directive}
  Lens: imagery=${r.lens.imagery}, voice=${r.lens.voice}, sound=${r.lens.sound}, syntax=${r.lens.syntax}, cultural=${r.lens.cultural}
  Unusualness budget: ${r.unusualnessBudget}`
    )
    .join("\n");

  const mustRules = recipes
    .map((r) => {
      const rules: string[] = [];

      // Voice-driven structural constraints
      if (r.lens.voice === "collective") {
        rules.push("MUST use a collective subject (we/our/us or equivalent).");
      } else if (r.lens.voice === "intimate") {
        rules.push(
          "MUST use intimate address (you/your or an equivalent direct address)."
        );
      } else if (r.lens.voice === "shift") {
        rules.push(
          "MUST shift grammatical perspective (e.g., passive, impersonal, or different subject) vs other variants."
        );
      }

      // Syntax-driven structural constraints
      if (r.lens.syntax === "fragment") {
        rules.push(
          "MUST use fragmented syntax (sentence fragments, dashes/line-break-like rhythm). Avoid full template sentences."
        );
      } else if (r.lens.syntax === "invert") {
        rules.push(
          "MUST use inversion: begin with a prepositional phrase/object and delay the subject."
        );
      } else if (r.lens.syntax === "adapt") {
        rules.push(
          "MUST vary clause structure vs other variants (change opener, re-order clauses, or change verb aspect)."
        );
      } else if (r.lens.syntax === "preserve") {
        rules.push(
          "MUST stay structurally close to the source, but still differ in wording from other variants."
        );
      }

      // Imagery constraints (impact structure by forcing different comparison styles)
      if (r.lens.imagery === "transform") {
        rules.push(
          "MUST transform the imagery: do NOT keep the same comparison template as the source."
        );
      } else if (r.lens.imagery === "substitute") {
        rules.push(
          "MUST substitute at least one central image with a culturally/locally resonant analogue."
        );
      }

      // Unusualness-driven constraints
      if (r.unusualnessBudget === "high") {
        rules.push(
          "MUST avoid the safest literal template. Take a clearly different structural approach."
        );
      }

      return `VARIANT ${r.label} MUST RULES:\n- ${rules.join("\n- ")}`;
    })
    .join("\n\n");

  // Detect if source contains comparison marker (simile trap detection)
  const hasComparisonMarker =
    /\b(comme|like|as if|as though|as|como|come)\b/i.test(sourceText);

  // Build comparison strategy rule (mode-scaled)
  let comparisonRule = "";
  if (hasComparisonMarker) {
    if (mode === "balanced" || mode === "adventurous") {
      comparisonRule = `
⚠️ COMPARISON STRATEGY CONSTRAINT (source contains simile/comparison marker):
- At most ONE variant may use an explicit comparison marker (like/as/comme/como/as if).
- Remaining variants MUST express the relation using:
  * Direct metaphor ("Rain is a thought…")
  * Plain statement ("Walking in rain feels…")
  * Fragment/ellipsis without comparison marker
- This rule is MANDATORY for ${mode?.toUpperCase()} mode.`;
    } else if (mode === "focused") {
      comparisonRule = `
ℹ️ COMPARISON STRATEGY (source contains simile/comparison marker):
- Focused mode allows simile reuse, but still prefer at least one variant without comparison marker for diversity.`;
    }
  }

  return `
═══════════════════════════════════════════════════════════════
VARIANT RECIPES (Your Three Viewpoints)
═══════════════════════════════════════════════════════════════
${recipeBlocks}

═══════════════════════════════════════════════════════════════
HARD STRUCTURAL DIVERGENCE (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════
${mustRules}

GLOBAL DIVERGENCE RULES:
- No two variants may start with the same first 2 non-stopword tokens.
- If any two drafts share the same sentence template, rewrite one BEFORE responding.
- Do NOT reuse the same key wording across variants unless it's in must_keep constraints.${comparisonRule}

MEANING ANCHORS INSTRUCTION (SEMANTIC, NOT LEXICAL):
Before generating each variant, internally identify 2-4 meaning anchors (core semantic facts/images, NOT exact tokens). ALL variants must preserve these semantic anchors, but you MUST use DIFFERENT surface realizations (lexical divergence) across variants. Anchors are semantic concepts, not word templates to copy. Do NOT output the anchors separately—just ensure the semantic content appears in each translation with varied wording.

CRITICAL: Each variant must be OBSERVABLY DIFFERENT in surface form (word choice, syntax, voice) while preserving the semantic meaning anchors.
`.trim();
}

/**
 * Build a recipe-aware prismatic generation prompt.
 *
 * @param params - Parameters for prompt generation
 * @returns System and user prompts for the LLM
 */
export function buildRecipeAwarePrismaticPrompt(params: {
  sourceText: string;
  recipes: VariantRecipesBundle;
  personality: TranslatorPersonality;
  currentTranslation?: string;
  context?: string;
}): { system: string; user: string } {
  const { sourceText, recipes, personality, currentTranslation, context } =
    params;

  const systemPrompt = `You are a translation variant generator following specific recipes.

Generate 3 distinct translation variants (A, B, C) for a single line of poetry.
Each variant MUST follow its assigned recipe exactly.

IMPORTANT RULES:
- Return ONLY valid JSON (no markdown, no explanations)
- Each variant must be OBSERVABLY DIFFERENT from the others
- ALL variants must honor the translator personality
- Preserve semantic meaning anchors (NOT exact wording) across all variants

SILENT SELF-CHECK (do NOT mention this in output):
1) Draft all 3 variants.
2) If any two share the same opening structure or comparison template, rewrite one until they differ.
3) Check comparison strategy constraints based on mode.
4) Ensure semantic anchors are preserved but with lexical diversity.
5) Only then output JSON.

Output format:
{
  "variants": [
    { "label": "A", "text": "translation", "rationale": "brief explanation", "confidence": 0.0-1.0 },
    { "label": "B", "text": "translation", "rationale": "brief explanation", "confidence": 0.0-1.0 },
    { "label": "C", "text": "translation", "rationale": "brief explanation", "confidence": 0.0-1.0 }
  ]
}`;

  const userPromptParts: string[] = [];

  // Translator personality section
  const sourceContext =
    personality.source_language_variety &&
    personality.source_language_variety.trim().length > 0
      ? `

SOURCE LANGUAGE CONTEXT:
${personality.source_language_notes ?? "Source language variety provided by user."}

⚠️ IMPORTANT: The source text is in ${personality.source_language_variety}.
- Be aware of dialect-/variety-specific expressions and idioms
- Don't mistake regional usage for errors
- Preserve cultural/regional flavor where appropriate
`
      : "";

  userPromptParts.push(
    `
═══════════════════════════════════════════════════════════════
TRANSLATOR PERSONALITY
═══════════════════════════════════════════════════════════════
Domain: ${personality.domain}
Purpose: ${personality.purpose}
Approach: ${personality.approach_summary}
Literalness: ${personality.literalness}/100
Register: ${
      personality.register.length > 0
        ? personality.register.join(", ")
        : "neutral"
    }
Priority: ${personality.priority}
${
  personality.sacred_terms.length > 0
    ? `MUST use: ${personality.sacred_terms.join(", ")}`
    : ""
}
${
  personality.forbidden_terms.length > 0
    ? `NEVER use: ${personality.forbidden_terms.join(", ")}`
    : ""
}
${sourceContext}
`.trim()
  );

  // Recipe block with anchors instruction (pass sourceText and mode)
  userPromptParts.push(
    buildRecipePromptBlock(recipes.recipes, sourceText, recipes.mode)
  );

  // Context section
  if (context) {
    userPromptParts.push(
      `
═══════════════════════════════════════════════════════════════
CONTEXT
═══════════════════════════════════════════════════════════════
${context}
`.trim()
    );
  }

  // Source line section
  userPromptParts.push(
    `
═══════════════════════════════════════════════════════════════
SOURCE LINE TO TRANSLATE
═══════════════════════════════════════════════════════════════
"${sourceText}"
${
  currentTranslation
    ? `\nCurrent translation (for reference): "${currentTranslation}"`
    : ""
}
`.trim()
  );

  // Task reminder
  userPromptParts.push(
    `
═══════════════════════════════════════════════════════════════
TASK
═══════════════════════════════════════════════════════════════
Generate 3 variants following the recipes above.
- Variant A: Follow Recipe A (${recipes.recipes[0].directive.slice(0, 50)}...)
- Variant B: Follow Recipe B (${recipes.recipes[1].directive.slice(0, 50)}...)
- Variant C: Follow Recipe C (${recipes.recipes[2].directive.slice(0, 50)}...)

Return ONLY valid JSON.
`.trim()
  );

  return {
    system: systemPrompt,
    user: userPromptParts.join("\n\n"),
  };
}
