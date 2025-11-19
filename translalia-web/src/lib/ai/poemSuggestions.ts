/**
 * Poem-level (macro) suggestion prompts for Notebook phase
 *
 * This module builds prompts that help students think about their
 * translation holistically after line-by-line work in Workshop.
 */

import { GuideAnswers } from "@/store/guideSlice";
import type {
  PoemMacroAnalysis,
  PoetryMacroCritiqueResponse,
} from "@/types/poemSuggestion";

/**
 * Analyze a poem for macro characteristics (rhyme, tone, imagery, etc.)
 */
function analyzePoemCharacteristics(
  poemText: string
): Omit<PoemMacroAnalysis, "sourceText" | "translationText"> {
  // Count lines
  const lines = poemText.split("\n").filter((l) => l.trim().length > 0);
  const lineCount = lines.length;

  // Try to detect rhyme scheme (simplified: look at line endings)
  const lineEndings = lines.map((line) => {
    const words = line.trim().split(/\s+/);
    const lastWord = words[words.length - 1]?.toLowerCase() || "";
    // Extract last 2-3 characters as rhyme key (very simplified)
    return lastWord.slice(-3);
  });

  // Simple rhyme detection: check if last 3 chars match
  const rhymeMap: Record<string, string> = {};
  let schemeString = "";
  let currentSchemeLabel = "A";
  const seenEndings: Record<string, string> = {};

  for (const ending of lineEndings) {
    if (!seenEndings[ending]) {
      seenEndings[ending] = currentSchemeLabel;
      currentSchemeLabel = String.fromCharCode(
        currentSchemeLabel.charCodeAt(0) + 1
      );
    }
    schemeString += seenEndings[ending];
  }

  const hasRhyme = Object.keys(seenEndings).length < lineCount * 0.8; // More than 20% rhyming

  // Line length variation (0 = uniform, 1 = highly varied)
  const lineLengths = lines.map((l) => l.length);
  const avgLength = lineLengths.reduce((a, b) => a + b, 0) / lineLengths.length;
  const variance =
    lineLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) /
    lineLengths.length;
  const stdDev = Math.sqrt(variance);
  const lineVariability = Math.min(1, stdDev / avgLength);

  return {
    rhymeScheme: hasRhyme ? schemeString : "none",
    rhymeType: hasRhyme ? "perfect" : "none", // Simplified
    hasRhyme,
    toneDescriptors: [],
    imageryPatterns: [],
    metricalPattern: "unknown", // Would need complex analysis
    lineVariability,
  };
}

/**
 * Build system prompt for macro poetry critique
 */
export function buildPoetryMacroSystemPrompt(
  guideAnswers?: GuideAnswers
): string {
  const preferenceLines: string[] = [];

  if (guideAnswers?.translationZone?.trim()) {
    preferenceLines.push(
      `Translation zone: ${guideAnswers.translationZone.trim()}`
    );
  }

  if (guideAnswers?.translationIntent?.trim()) {
    preferenceLines.push(
      `Translation intent: ${guideAnswers.translationIntent.trim()}`
    );
  }

  const preferencesSection =
    preferenceLines.length > 0
      ? `\nStudent's Translation Preferences:\n${preferenceLines.join("\n")}`
      : "";

  return `You are an expert poetry translator and literary critic specializing in helping students think about translation choices at the macro (whole-poem) level.${preferencesSection}

Your role is to:
1. Analyze the SOURCE poem for its key characteristics (rhyme scheme, tone, imagery patterns, rhythm, form)
2. Analyze the STUDENT'S TRANSLATION for the same characteristics
3. Generate 3-5 specific, actionable suggestions for refinement
4. Present suggestions as options to explore, not mandatory changes
5. Help the student see translation as a series of CHOICES, not as mechanical transcription

Each suggestion should:
- Focus on macro (whole-poem) effects, not individual words
- Offer concrete next steps the student can take
- Acknowledge what the student has already done well
- Be phrased as an invitation to explore ("Would you like to try...?") rather than a criticism

Format your response as JSON matching the expected structure exactly.`;
}

/**
 * Build user prompt for macro poetry critique
 */
export function buildPoetryMacroUserPrompt(
  sourcePoem: string,
  translationPoem: string
): string {
  return `Please analyze these two poems and generate suggestions for how the student might refine their translation at the macro level.

SOURCE POEM:
${sourcePoem}

STUDENT'S TRANSLATION:
${translationPoem}

Analyze both poems for:
1. Rhyme scheme and rhyme type (perfect/slant/internal/none)
2. Overall tone and register (formal/casual/archaic/modern/etc.)
3. Imagery patterns and metaphorical language
4. Rhythm and line length patterns
5. Form and structure (sonnet/haiku/free verse/etc.)

Generate 3-5 specific suggestions that help the student refine their translation.

Each suggestion should include:
- A clear category (rhyme_strategy, tone_register, meaning_expansion, rhythm_meter, imagery_style, or form_structure)
- 2-4 options within that category, each with:
  - A title (what they could try)
  - A description (what would change)
  - A rationale (why this matters or what the effect would be)
  - An action (specific lines or approach to modify)
  - A difficulty rating (easy/medium/challenging)
- An explanation of what you observed in the SOURCE
- An explanation of what you observed in their TRANSLATION
- Whether this suggestion is applicable (some poems don't rhyme, some don't have metaphors, etc.)

Focus on helping the student see translation as a series of CHOICES about what to preserve, transform, or reinterpret.`;
}

/**
 * Validate and parse the macro critique response
 */
export function parsePoetryMacroCritiqueResponse(
  jsonString: string
): PoetryMacroCritiqueResponse | null {
  try {
    const parsed = JSON.parse(jsonString) as PoetryMacroCritiqueResponse;

    // Validate structure
    if (
      !parsed.suggestions ||
      !Array.isArray(parsed.suggestions) ||
      parsed.suggestions.length === 0
    ) {
      console.warn("[poemSuggestions] Invalid suggestions array");
      return null;
    }

    return parsed;
  } catch (e) {
    console.error("[poemSuggestions] Failed to parse response:", e);
    return null;
  }
}

/**
 * Fallback suggestions generator (if LLM fails)
 * Generates basic suggestions based on simple heuristics
 */
export function generateFallbackSuggestions(
  sourceText: string,
  translationText: string
): PoetryMacroCritiqueResponse {
  const sourceAnalysis: PoemMacroAnalysis = {
    ...analyzePoemCharacteristics(sourceText),
    sourceText,
  };

  const translationAnalysis: PoemMacroAnalysis = {
    ...analyzePoemCharacteristics(translationText),
    translationText,
  };

  return {
    sourceAnalysis,
    translationAnalysis,
    suggestions: [
      {
        id: "rhyme-exploration",
        category: "rhyme_strategy",
        categoryLabel: "Rhyme Strategy",
        categoryIcon: "Music",
        options: [
          {
            id: "match-source-rhyme",
            title: "Match the source poem's rhyme pattern",
            description:
              "If the source poem uses rhyme, try using the same rhyme scheme in your translation",
            rationale: "Rhyme is a structural choice that can carry meaning",
            action: "Look at your current line endings and consider rewording to match the source rhyme scheme",
            difficulty: "medium",
          },
          {
            id: "create-new-rhyme",
            title: "Introduce rhyme differently",
            description:
              "Use rhyme in a way that feels natural to the target language, even if different from source",
            rationale:
              "Different languages have different phonetic qualities; rhyming differently might feel more authentic",
            action: "Identify lines that could rhyme and reword them to create new rhyme patterns",
            difficulty: "challenging",
          },
        ],
        sourceAnalysis: "Source rhyme analysis (simplified)",
        yourTranslation: "Your translation rhyme analysis (simplified)",
        isApplicable: true,
      },
      {
        id: "tone-exploration",
        category: "tone_register",
        categoryLabel: "Tone & Register",
        categoryIcon: "Lightbulb",
        options: [
          {
            id: "match-source-tone",
            title: "Match the source poem's tone",
            description:
              "If the source is formal, try a more formal register; if colloquial, try a more casual tone",
            rationale: "Tone shapes how readers experience the translation",
            action: "Read your translation aloud. Does it feel like the source? Adjust vocabulary and phrasing if needed",
            difficulty: "medium",
          },
          {
            id: "explore-register",
            title: "Try a different register",
            description:
              "Experiment with more formal or more casual language choices",
            rationale:
              "Different registers open up different interpretations of the poem",
            action: "Rewrite a few lines using distinctly different vocabulary (more/less formal)",
            difficulty: "medium",
          },
        ],
        sourceAnalysis: "Source tone analysis (simplified)",
        yourTranslation: "Your translation tone analysis (simplified)",
        isApplicable: true,
      },
    ],
    overallObservations:
      "Your translation is a solid first draft. Consider exploring the suggestions above to refine it further.",
    studentPromptsToConsider: [
      "What choices did you make in your translation? Why?",
      "What aspects of the source poem are most important to preserve?",
      "What would change if you used different rhyme/tone/imagery?",
    ],
  };
}
