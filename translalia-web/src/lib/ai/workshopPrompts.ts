import { GuideAnswers } from "@/store/guideSlice";
import { DragData } from "@/types/drag";

const WORD_CLOSENESS_DESCRIPTIONS = {
  close: "Stay close to the literal meaning",
  in_between: "Balance literal and creative interpretations",
  natural: "Prioritize natural, idiomatic expression in the target language",
} as const;

const LINE_CLOSENESS_DESCRIPTIONS = {
  close: "Stay as close as possible to the literal meaning",
  in_between: "Balance literal accuracy with natural expression",
  natural: "Prioritize natural, idiomatic expression",
} as const;

function collectPreferenceLines(
  guideAnswers: GuideAnswers,
  mode: "word" | "line"
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
    const description =
      mode === "word"
        ? WORD_CLOSENESS_DESCRIPTIONS[closeness]
        : LINE_CLOSENESS_DESCRIPTIONS[closeness];
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
      mode === "word"
        ? "Translation approach: Balance literal and creative interpretations"
        : "Translation approach: Balance literal accuracy with natural expression"
    );
  }

  return lines;
}

function formatPreferenceSection(
  guideAnswers: GuideAnswers,
  mode: "word" | "line"
): string {
  const lines = collectPreferenceLines(guideAnswers, mode);
  if (lines.length === 0) {
    return "- No specific instructions provided.";
  }
  return lines.map((line) => `- ${line}`).join("\n");
}

export interface WordTranslationContext {
  word: string;
  lineContext: string;
  guideAnswers: GuideAnswers;
  sourceLanguage?: string;
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
 * Builds a GPT prompt for generating translation options for a single word.
 * Uses Guide Rail answers for context-aware, style-consistent translations.
 */
export function buildWordTranslationPrompt({
  word,
  lineContext,
  guideAnswers,
  sourceLanguage = "the source language",
}: WordTranslationContext): string {
  const translationIntent = guideAnswers.translationIntent?.trim();
  const targetLanguage = guideAnswers.targetLanguage?.lang?.trim();
  const targetVariety = guideAnswers.targetLanguage?.variety?.trim();
  const targetDescriptor = targetLanguage
    ? `${targetLanguage}${targetVariety ? ` (${targetVariety} variety)` : ""}`
    : translationIntent
    ? "the language specified in the translator instructions"
    : "the target language";

  const closenessKey = guideAnswers.stance?.closeness || "in_between";
  const closenessSummary = WORD_CLOSENESS_DESCRIPTIONS[closenessKey];
  const preferenceSection = formatPreferenceSection(guideAnswers, "word");

  return `You are translating poetry from ${sourceLanguage} to ${targetDescriptor}.

Translator instructions:
${preferenceSection}

Line being translated: "${lineContext}"
Focus word: "${word}"

Provide exactly 3 translation options for "${word}" that:
1. Honour the translator instructions above.
2. Fit naturally within the line context.
3. Span from literal to more creative interpretations (${closenessSummary}).

Keep each option to a single word or short phrase.
Also identify the part of speech for "${word}" in this context.

Return ONLY a JSON object with this exact structure:
{
  "partOfSpeech": "noun|verb|adjective|adverb|pronoun|preposition|conjunction|article|interjection",
  "options": ["option1", "option2", "option3"]
}`;
}

/**
 * Builds a system prompt for the workshop translation task.
 */
export function buildWorkshopSystemPrompt(): string {
  return `You are a poetry translation assistant. Your task is to provide translation options for individual words within poetic lines.

IMPORTANT:
- Return ONLY a valid JSON object with "partOfSpeech" and "options" fields
- No explanations, no markdown, no additional formatting
- Each option should be a single word or short phrase
- Options should vary from literal to creative
- Consider the poetic context and style preferences
- Identify the part of speech accurately based on context

Example valid response:
{
  "partOfSpeech": "noun",
  "options": ["love", "affection", "devotion"]
}`;
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
export function buildLineTranslationPrompt({
  lineText,
  lineIndex,
  fullPoem,
  stanzaIndex,
  prevLine,
  nextLine,
  guideAnswers,
  sourceLanguage = "the source language",
}: LineTranslationContext): string {
  const closenessKey = guideAnswers.stance?.closeness || "in_between";
  const closenessSummary = LINE_CLOSENESS_DESCRIPTIONS[closenessKey];
  const preferenceSection = formatPreferenceSection(guideAnswers, "line");

  // ============================================
  // STATIC SECTION – same for whole session
  // ============================================
  const staticSections: string[] = [];

  // Full poem context (always include if available)
  // Include source language context for clarity
  if (fullPoem) {
    staticSections.push(`You are translating a poem from ${sourceLanguage}. Here is the FULL POEM for context:

"""
${fullPoem}
"""`);
  } else {
    // Fallback if full poem is not available (should be rare)
    staticSections.push(`You are translating a poem from ${sourceLanguage}.`);
  }

  // Translation preferences
  staticSections.push(`
Translation preferences:
${preferenceSection}`);

  // ============================================
  // DYNAMIC SECTION – changes per line
  // ============================================
  const dynamicSections: string[] = [];

  // Build line identifier with chunk and line numbers
  const lineNumber = lineIndex + 1; // Convert to 1-indexed for display
  const chunkNumber = stanzaIndex !== undefined ? stanzaIndex + 1 : undefined;

  if (chunkNumber !== undefined) {
    dynamicSections.push(`Focus on this specific line:
- Chunk ${chunkNumber}, Line ${lineNumber}: "${lineText}"`);
  } else {
    dynamicSections.push(`Focus on this specific line:
- Line ${lineNumber}: "${lineText}"`);
  }

  // Previous and next line context
  if (prevLine) {
    dynamicSections.push(`- Previous line: "${prevLine}"`);
  }
  if (nextLine) {
    dynamicSections.push(`- Next line: "${nextLine}"`);
  }

  // ============================================
  // Combine sections
  // ============================================
  const staticSection = staticSections.join("\n");
  const dynamicSection = dynamicSections.join("\n");

  return `${staticSection}

${dynamicSection}

TASK:
Generate exactly 3 translation variants for this line. Each variant should:
1. Honor the translator instructions above
2. Fit naturally within the poetic context${
    prevLine || nextLine ? " (consider adjacent lines)" : ""
  }
3. Span from literal to more creative interpretations (${closenessSummary})
4. Maintain poetic quality and flow

ALIGNMENT REQUIREMENTS:
- For each variant, provide sub-token alignment mapping original words/phrases to translations
- Handle multi-word chunks correctly (e.g., "sat on" → "se sentó en")
- Every word in the original line must be accounted for in the alignment
- Position numbers should reflect the order in the original line (0-indexed)

METADATA REQUIREMENTS:
- literalness: Score 0-1 (1 = very literal, 0 = very creative)
- characterCount: Count characters in the translated line
- preservesRhyme: true if rhyme scheme is maintained (if applicable)
- preservesMeter: true if meter/rhythm is maintained (if applicable)

Return ONLY a JSON object with this exact structure:
{
  "translations": [
    {
      "variant": 1,
      "fullText": "complete translated line",
      "words": [
        {
          "original": "word or phrase",
          "translation": "translated word or phrase",
          "partOfSpeech": "noun|verb|adjective|adverb|pronoun|preposition|conjunction|article|interjection",
          "position": 0
        }
      ],
      "metadata": {
        "literalness": 0.8,
        "characterCount": 31,
        "preservesRhyme": true,
        "preservesMeter": true
      }
    },
    {
      "variant": 2,
      "fullText": "...",
      "words": [...],
      "metadata": {...}
    },
    {
      "variant": 3,
      "fullText": "...",
      "words": [...],
      "metadata": {...}
    }
  ]
}`;
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
