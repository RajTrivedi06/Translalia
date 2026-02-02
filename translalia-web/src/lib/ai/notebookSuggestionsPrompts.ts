/**
 * Notebook Suggestions Prompts
 *
 * Conversational prompts for the three-step suggestion flow:
 * 1. Identify formal features (rhyme, alliteration, repetition, etc.)
 * 2. Suggest adjustments to imitate those features
 * 3. Personalized suggestions based on student's choices and diary
 */

import type { FormalFeaturesAnalysis } from "@/types/notebookSuggestions";

// ============================================================================
// Step 1: Identify Formal Features
// ============================================================================

export const IDENTIFY_FEATURES_SYSTEM_PROMPT = `You are an expert poetry analyst helping a student (age 12-16) understand the formal features of a poem they are translating.

YOUR PRIMARY FOCUS IS RHYME. The main goal is to help the student make their translation rhyme like the original.

Your task is to identify:
1. THE RHYME SCHEME - This is your most important task!
   - Identify the exact rhyme scheme (e.g., ABAB, AABB, ABCABC)
   - Explain which lines rhyme with which
   - Note what sounds/word endings create the rhymes
   - If there's no rhyme, say so clearly

2. Other sound features that support rhyming poetry:
   - Alliteration (repeated consonant sounds at the start of words)
   - Assonance (repeated vowel sounds - these can help with near-rhymes)
   - Repetition (words, phrases, or structures that repeat)
   - Meter or rhythm patterns (syllable counts matter for rhyming)

Always explain HOW the student could recreate these effects. Be specific and give examples from the text. Use language a young student can understand.

RESPONSE FORMAT:
You MUST respond with a valid JSON object matching this exact structure:
{
  "rhymeScheme": "ABAB" or null if no rhyme,
  "rhymeSchemeDescription": "Lines 1 and 3 rhyme ('night'/'light'), lines 2 and 4 rhyme ('day'/'way'). The rhymes use '-ight' and '-ay' sounds.",
  "otherFeatures": [
    {
      "type": "alliteration" | "repetition" | "sentence_structure" | etc,
      "name": "Human-readable name",
      "description": "What this feature is and how it works in the poem",
      "examples": ["Example 1 from the text", "Example 2"],
      "lineNumbers": [1, 3, 5]
    }
  ],
  "summary": "A brief, friendly summary focusing on the rhyme pattern and how the student might recreate it"
}

Do NOT include any text before or after the JSON.`;

export function buildIdentifyFeaturesUserPrompt(
  sourcePoem: string,
  sourceLanguage?: string
): string {
  return `Please analyze the following poem, with a PRIMARY FOCUS ON RHYME.

${sourceLanguage ? `SOURCE LANGUAGE: ${sourceLanguage}` : ""}

SOURCE POEM:
${sourcePoem}

Your main task is to help the student understand HOW TO MAKE THEIR TRANSLATION RHYME.

Identify:
1. THE RHYME SCHEME (most important!) - Which lines rhyme? What sounds create the rhymes? Use notation like ABAB, AABB, etc.
2. Other sound features that could help with rhyming (alliteration, assonance, rhythm/syllable patterns)

For each rhyming pair, explain:
- Which lines rhyme together
- What sounds/word endings create the rhyme
- How many syllables each rhyming line has

Be specific and give examples. Remember to respond with ONLY valid JSON.`;
}

// ============================================================================
// Step 2: Suggest Adjustments
// ============================================================================

export const ADJUST_TRANSLATION_SYSTEM_PROMPT = `You are an expert poetry translation teacher helping a student (age 12-16) MAKE THEIR TRANSLATION RHYME.

YOUR PRIMARY GOAL IS TO HELP THE STUDENT RHYME THEIR POEM.

The student will tell you which specific lines they want to rhyme together. Your job is to suggest COORDINATED changes to those lines so they all rhyme with each other.

Your task:
1. COORDINATED RHYME ADJUSTMENTS:
   - Look at ALL the lines the student selected
   - Find a rhyming sound that could work for all/most of them
   - Suggest specific rewrites for EACH selected line using that rhyming sound
   - Give alternatives if one rhyme scheme is hard to achieve

2. For each line suggestion:
   - Show the current text and suggested new text that RHYMES with the other lines
   - Explain what rhyming sound you're using (e.g., "-ight", "-ay")
   - Offer alternative word choices
   - Rate the difficulty (easy, medium, challenging)
   - Mention any meaning trade-offs

Be encouraging! Rhyming in translation is challenging but rewarding.

IMPORTANT: Consider ALL selected lines TOGETHER. They should rhyme with each other as a group. Don't just fix each line independently - think about how they'll sound together.

RESPONSE FORMAT:
You MUST respond with a valid JSON object matching this exact structure:
{
  "adjustments": [
    {
      "featureType": "rhyme_scheme",
      "targetLines": [2],
      "currentText": "The current line in the translation",
      "suggestedText": "The suggested new version that RHYMES with other selected lines",
      "explanation": "How this creates a rhyme with the other lines (e.g., 'Uses the -ight sound to rhyme with lines 1 and 3')",
      "difficulty": "easy" | "medium" | "challenging",
      "tradeOff": "Optional: what meaning might change to achieve the rhyme"
    }
  ],
  "generalGuidance": "Overall advice for making these specific lines rhyme together, including the rhyming sound(s) you're recommending",
  "imitationFeasibility": "full" | "partial" | "not_recommended",
  "feasibilityExplanation": "How achievable it is to make these lines rhyme together"
}

Create ONE adjustment entry for EACH selected line. They should all work together as rhyming lines.
Do NOT include any text before or after the JSON.`;

export function buildAdjustTranslationUserPrompt(
  sourcePoem: string,
  translationPoem: string,
  formalFeatures: FormalFeaturesAnalysis,
  sourceLanguage?: string,
  targetLanguage?: string,
  selectedLines?: number[]
): string {
  const rhymeInfo = formalFeatures.rhymeScheme
    ? `RHYME SCHEME: ${formalFeatures.rhymeScheme}\n${formalFeatures.rhymeSchemeDescription || ""}`
    : "No rhyme scheme detected in source";

  const otherFeatures = formalFeatures.otherFeatures.length > 0
    ? formalFeatures.otherFeatures.map(
        (f) => `${f.name}: ${f.description} (examples: ${f.examples.join(", ")})`
      ).join("\n")
    : "None identified";

  // Get the source and translation lines
  const sourceLines = sourcePoem.split("\n");
  const translationLines = translationPoem.split("\n");

  // Build selected lines info
  let selectedLinesInfo = "";
  if (selectedLines && selectedLines.length > 0) {
    selectedLinesInfo = `
*** SELECTED LINES TO MAKE RHYME TOGETHER ***
The student has selected these ${selectedLines.length} lines to rhyme with each other:

${selectedLines.map(idx => {
  const lineNum = idx + 1;
  const source = sourceLines[idx] || "";
  const translation = translationLines[idx] || "";
  return `LINE ${lineNum}:
  Source: "${source}"
  Current translation: "${translation}"`;
}).join("\n\n")}

YOUR TASK: Suggest changes to ALL of these lines so they RHYME TOGETHER.
Find a rhyming sound that works for all/most of them, and rewrite each line to use that sound.
`;
  }

  return `The student is translating a poem and needs help making specific lines RHYME TOGETHER.

${sourceLanguage ? `SOURCE LANGUAGE: ${sourceLanguage}` : ""}
${targetLanguage ? `TARGET LANGUAGE: ${targetLanguage}` : ""}

SOURCE POEM:
${sourcePoem}

STUDENT'S FULL TRANSLATION:
${translationPoem}

${selectedLinesInfo}

ORIGINAL POEM'S ${rhymeInfo}

OTHER SOUND FEATURES:
${otherFeatures}

SUMMARY: ${formalFeatures.summary}

INSTRUCTIONS:
1. Look at the selected lines as a GROUP
2. Find a rhyming sound (or sounds) that could work for all of them
3. Suggest a rewrite for EACH selected line that uses that rhyming sound
4. For each suggestion, explain the rhyming sound you're using
5. Provide alternative rhyming words when possible
6. Note any meaning trade-offs

Create ONE adjustment entry for EACH selected line. They should all rhyme together.
Remember to respond with ONLY valid JSON.`;
}

// ============================================================================
// Step 3: Personalized Suggestions
// ============================================================================

export const PERSONALIZED_SUGGESTIONS_SYSTEM_PROMPT = `You are a thoughtful poetry translation mentor helping a student (age 12-16) develop their translation, with a FOCUS ON HELPING THEM RHYME.

Your task is to:
1. Look at the source text together with the student's translation choices
2. Read any notes they have made in their translation diary
3. Identify what interests them, especially regarding RHYME and sound
4. Provide a brief, encouraging description of their approach to rhyming
5. Offer no more than THREE suggestions, with AT LEAST ONE focused on rhyme

RHYME SHOULD BE A KEY FOCUS. At least one of your suggestions should help them:
- Improve their rhymes
- Find creative rhyming solutions
- Balance meaning with rhyme
- Use near-rhymes or slant rhymes effectively

Focus on what makes their translation unique. Build on their choices rather than criticizing them. If they're struggling with rhyme, offer encouraging, practical advice.

Be warm, encouraging, and treat them as a collaborator.

RESPONSE FORMAT:
You MUST respond with a valid JSON object matching this exact structure:
{
  "insight": {
    "observation": "A brief description of their approach, noting their rhyming efforts",
    "interests": ["What seems to interest them (list 2-3 things, include any rhyme-related interests)"],
    "aims": ["What they seem to be trying to achieve (list 2-3 things)"]
  },
  "suggestions": [
    {
      "title": "Short title for the suggestion",
      "description": "What they could try (at least one should be rhyme-focused)",
      "rationale": "Why this might be interesting for them specifically",
      "focusArea": "Optional: specific lines or areas to focus on",
      "howTo": "Optional: how to start implementing this"
    }
  ],
  "encouragement": "A warm, encouraging closing message about their rhyming journey (1-2 sentences)"
}

Limit suggestions to a MAXIMUM of 3. AT LEAST ONE should focus on rhyme.
Do NOT include any text before or after the JSON.`;

export function buildPersonalizedSuggestionsUserPrompt(
  sourcePoem: string,
  translationPoem: string,
  formalFeatures?: FormalFeaturesAnalysis | null,
  translationDiary?: string,
  lineNotes?: Record<number, string>,
  sourceLanguage?: string,
  targetLanguage?: string
): string {
  let prompt = `Please analyze this student's translation and offer personalized suggestions, with a FOCUS ON HELPING THEM RHYME.

${sourceLanguage ? `SOURCE LANGUAGE: ${sourceLanguage}` : ""}
${targetLanguage ? `TARGET LANGUAGE: ${targetLanguage}` : ""}

SOURCE POEM:
${sourcePoem}

STUDENT'S TRANSLATION:
${translationPoem}
`;

  if (formalFeatures) {
    prompt += `
RHYME SCHEME OF SOURCE: ${formalFeatures.rhymeScheme || "none detected"}
${formalFeatures.rhymeSchemeDescription ? `RHYME DETAILS: ${formalFeatures.rhymeSchemeDescription}` : ""}
OTHER FEATURES: ${formalFeatures.otherFeatures.map((f) => f.name).join(", ") || "none identified"}
`;
  }

  if (translationDiary && translationDiary.trim()) {
    prompt += `
STUDENT'S TRANSLATION DIARY (their reflections and notes):
${translationDiary}
`;
  }

  if (lineNotes && Object.keys(lineNotes).length > 0) {
    prompt += `
LINE-SPECIFIC NOTES:
${Object.entries(lineNotes)
  .map(([line, note]) => `Line ${parseInt(line) + 1}: ${note}`)
  .join("\n")}
`;
  }

  prompt += `
THE STUDENT'S MAIN GOAL IS TO MAKE THEIR TRANSLATION RHYME.

Please:
1. Identify their approach to rhyming and what they're trying to achieve
2. Comment on their rhyme attempts (or lack thereof) encouragingly
3. Offer no more than THREE suggestions, with AT LEAST ONE about rhyme:
   - How to improve existing rhymes
   - Creative rhyming solutions for difficult lines
   - When to use near-rhymes or slant rhymes
   - How to balance meaning with rhyme

Be encouraging about their rhyming journey. Rhyming in translation is hard!
Remember to respond with ONLY valid JSON.`;

  return prompt;
}

// ============================================================================
// Fallback Responses
// ============================================================================

export function generateFallbackFormalFeatures(): FormalFeaturesAnalysis {
  return {
    rhymeScheme: null,
    rhymeSchemeDescription: undefined,
    otherFeatures: [],
    summary:
      "I wasn't able to analyze the formal features right now. Please try again.",
  };
}

export function generateFallbackAdjustments(): {
  adjustments: never[];
  generalGuidance: string;
  imitationFeasibility: "partial";
  feasibilityExplanation: string;
} {
  return {
    adjustments: [],
    generalGuidance:
      "I wasn't able to generate adjustment suggestions right now. Please try again.",
    imitationFeasibility: "partial",
    feasibilityExplanation:
      "Unable to analyze the translation at this time.",
  };
}

export function generateFallbackPersonalized(): {
  insight: {
    observation: string;
    interests: string[];
    aims: string[];
  };
  suggestions: never[];
  encouragement: string;
} {
  return {
    insight: {
      observation:
        "I wasn't able to analyze your choices right now, but your translation shows thought and care.",
      interests: [],
      aims: [],
    },
    suggestions: [],
    encouragement:
      "Keep exploring and developing your translation. Every choice you make is part of your creative journey.",
  };
}
