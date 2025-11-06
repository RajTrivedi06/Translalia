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
  const translationZone = (guideAnswers as any)?.translationZone?.trim();
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
