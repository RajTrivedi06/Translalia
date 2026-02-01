/**
 * Rhyme Workshop Prompts
 *
 * Instructive prompts for teaching students HOW to achieve rhyme,
 * sound patterns, and rhythm in their translations.
 *
 * Key principle: Be SPECIFIC and ACTIONABLE, not just descriptive.
 */

import type {
  RhymeResult,
  RhymeDictionaryData,
} from "@/types/rhymeWorkshop";
import type { LineAnalysis } from "@/lib/rhyme/soundAnalysis";

// ============================================================================
// System Prompts
// ============================================================================

export const RHYME_WORKSHOP_SYSTEM_PROMPT = `You are an expert poetry translation teacher helping a student (age 12-16) improve the sonic qualities of their translation. Your instruction must be:

- SPECIFIC: Give exact words, sounds, and line rewrites—not vague advice
- PRACTICAL: Show multiple options with clear trade-offs
- EDUCATIONAL: Explain WHY each technique works

RESPONSE FORMAT:
You MUST respond with a valid JSON object matching this exact structure:
{
  "rhymeWorkshop": [...],
  "soundWorkshop": [...],
  "rhythmWorkshop": [...]
}

Do NOT include any text before or after the JSON. Do NOT use markdown code blocks.

RHYME INSTRUCTION FRAMEWORK:
When suggesting rhymes:
1. State the target rhyme sound clearly (e.g., "You need an '-ight' sound")
2. List 5-8 candidate rhyming words
3. Identify which candidates fit the meaning (with brief reasons)
4. Provide 2-3 specific line rewrites
5. Explain the trade-off of each option (meaning, syllables, register)

SLANT RHYME TECHNIQUES:
When perfect rhyme is difficult, teach alternatives:
- Consonance rhymes (same ending consonants): "bat" / "boat"
- Assonance rhymes (same vowel sounds): "lake" / "fate"
- Half rhymes (similar but not identical): "moon" / "on"

SOUND PATTERN INSTRUCTION:
When suggesting alliteration, assonance, or consonance:
1. Identify the source's pattern with specific examples
2. Name the target sound (e.g., "'s' consonant" or "long 'o' vowel")
3. Provide 3+ word substitution options
4. Show how each changes the line
5. Recommend the best fit

RHYTHM INSTRUCTION:
When addressing rhythm:
1. Count syllables explicitly for source AND current translation
2. Show stress patterns using da-DUM notation
3. Provide tighter/looser alternatives with syllable counts
4. Explain what is gained/lost with each option`;

// ============================================================================
// User Prompt Builder
// ============================================================================

export interface RhymeWorkshopPromptParams {
  lineIndex: number;
  sourceLine: string;
  currentTranslation: string;
  previousLine?: string | null;
  nextLine?: string | null;
  previousTranslation?: string | null;
  nextTranslation?: string | null;
  fullSourcePoem: string;
  fullTranslation: string;
  sourceLanguage: string;
  targetLanguage: string;
  rhymeDictionaryData?: RhymeDictionaryData;
  sourceLineAnalysis?: LineAnalysis;
  currentLineAnalysis?: LineAnalysis;
  sourceRhymeScheme?: string;
  rhymeTargetLines?: number[];
}

export function buildRhymeWorkshopUserPrompt(
  params: RhymeWorkshopPromptParams
): string {
  const {
    lineIndex,
    sourceLine,
    currentTranslation,
    previousLine,
    nextLine,
    previousTranslation,
    nextTranslation,
    fullSourcePoem,
    fullTranslation,
    sourceLanguage,
    targetLanguage,
    rhymeDictionaryData,
    sourceLineAnalysis,
    currentLineAnalysis,
    sourceRhymeScheme,
    rhymeTargetLines,
  } = params;

  let prompt = `Analyze this translation and provide INSTRUCTIVE suggestions for rhyme, sound patterns, and rhythm.

SOURCE POEM (${sourceLanguage}):
${fullSourcePoem}

STUDENT'S TRANSLATION (${targetLanguage}):
${fullTranslation}

FOCUS LINE (Line ${lineIndex + 1}):
- Source: "${sourceLine}"
- Current translation: "${currentTranslation}"
`;

  if (previousLine || nextLine) {
    prompt += `
CONTEXT:
${previousLine ? `- Previous source line: "${previousLine}"` : ""}
${previousTranslation ? `- Previous translation: "${previousTranslation}"` : ""}
${nextLine ? `- Next source line: "${nextLine}"` : ""}
${nextTranslation ? `- Next translation: "${nextTranslation}"` : ""}
`;
  }

  if (sourceRhymeScheme) {
    prompt += `
SOURCE RHYME SCHEME: ${sourceRhymeScheme}
`;
  }

  if (rhymeTargetLines && rhymeTargetLines.length > 0) {
    prompt += `
LINES THAT SHOULD RHYME WITH LINE ${lineIndex + 1}: ${rhymeTargetLines.map((l) => l + 1).join(", ")}
`;
  }

  if (rhymeDictionaryData && rhymeDictionaryData.lineEndingRhymes.length > 0) {
    prompt += `
RHYME DICTIONARY DATA (use these as starting points):
`;
    for (const rhymeResult of rhymeDictionaryData.lineEndingRhymes) {
      if (rhymeResult.perfectRhymes.length > 0 || rhymeResult.nearRhymes.length > 0) {
        prompt += `Word: "${rhymeResult.word}"
  - Perfect rhymes: ${rhymeResult.perfectRhymes.slice(0, 8).join(", ") || "none found"}
  - Near rhymes: ${rhymeResult.nearRhymes.slice(0, 6).join(", ") || "none found"}
`;
      }
    }
  }

  if (sourceLineAnalysis) {
    prompt += `
SOURCE LINE ANALYSIS:
- Syllables: ${sourceLineAnalysis.syllableCount}
- Stress pattern: ${sourceLineAnalysis.stressPattern}
${sourceLineAnalysis.alliteration.length > 0 ? `- Alliteration: ${sourceLineAnalysis.alliteration.map((a) => `'${a.consonant}' in [${a.words.join(", ")}]`).join("; ")}` : ""}
${sourceLineAnalysis.assonance.length > 0 ? `- Assonance: ${sourceLineAnalysis.assonance.map((a) => `'${a.vowel}' in [${a.words.join(", ")}]`).join("; ")}` : ""}
`;
  }

  if (currentLineAnalysis) {
    prompt += `
CURRENT TRANSLATION ANALYSIS:
- Syllables: ${currentLineAnalysis.syllableCount}
- Stress pattern: ${currentLineAnalysis.stressPattern}
${currentLineAnalysis.alliteration.length > 0 ? `- Alliteration: ${currentLineAnalysis.alliteration.map((a) => `'${a.consonant}' in [${a.words.join(", ")}]`).join("; ")}` : ""}
${currentLineAnalysis.assonance.length > 0 ? `- Assonance: ${currentLineAnalysis.assonance.map((a) => `'${a.vowel}' in [${a.words.join(", ")}]`).join("; ")}` : ""}
`;
  }

  prompt += `
TASK:
Generate specific, actionable suggestions in these three categories:

1. RHYME WORKSHOP (rhymeWorkshop):
   - If the source has rhyme, show how to achieve it in the translation
   - Provide candidate words, semantic analysis, and specific rewrites
   - Include syllable counts for each suggestion

2. SOUND WORKSHOP (soundWorkshop):
   - Identify sound patterns in the source (alliteration, assonance, consonance)
   - Show how to recreate them in the translation
   - Provide specific word substitutions

3. RHYTHM WORKSHOP (rhythmWorkshop):
   - Compare syllable counts and stress patterns
   - Suggest alternatives that match the source's rhythm
   - Explain trade-offs of each option

Respond with ONLY a valid JSON object. No markdown, no explanation text.`;

  return prompt;
}

// ============================================================================
// Response JSON Schema (for structured output)
// ============================================================================

export const RHYME_WORKSHOP_JSON_SCHEMA = {
  type: "object",
  properties: {
    rhymeWorkshop: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["perfect_rhyme", "slant_rhyme", "internal_rhyme"],
          },
          targetLines: {
            type: "array",
            items: { type: "integer" },
            minItems: 2,
            maxItems: 2,
          },
          targetSound: { type: "string" },
          instruction: { type: "string" },
          currentLines: {
            type: "object",
            properties: {
              line1: { type: "string" },
              line2: { type: "string" },
            },
            required: ["line1", "line2"],
          },
          candidateWords: {
            type: "array",
            items: { type: "string" },
          },
          semanticallyRelevant: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          suggestedRewrites: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                technique: { type: "string" },
                tradeOff: { type: "string" },
                syllables: {
                  type: "object",
                  properties: {
                    current: { type: "integer" },
                    suggested: { type: "integer" },
                    source: { type: "integer" },
                  },
                },
              },
              required: ["text", "technique", "tradeOff"],
            },
          },
          recommendation: { type: "string" },
        },
        required: [
          "type",
          "targetLines",
          "targetSound",
          "instruction",
          "currentLines",
          "candidateWords",
          "semanticallyRelevant",
          "suggestedRewrites",
          "recommendation",
        ],
      },
    },
    soundWorkshop: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["alliteration", "assonance", "consonance"],
          },
          lineIndex: { type: "integer" },
          sourcePattern: { type: "string" },
          targetSound: { type: "string" },
          currentText: { type: "string" },
          analysis: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                soundCount: { type: "integer" },
                note: { type: "string" },
              },
              required: ["text", "soundCount", "note"],
            },
          },
          recommendation: { type: "string" },
        },
        required: [
          "type",
          "lineIndex",
          "sourcePattern",
          "targetSound",
          "currentText",
          "options",
          "recommendation",
        ],
      },
    },
    rhythmWorkshop: {
      type: "array",
      items: {
        type: "object",
        properties: {
          lineIndex: { type: "integer" },
          analysis: {
            type: "object",
            properties: {
              source: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  syllables: { type: "integer" },
                  stress: { type: "string" },
                },
                required: ["text", "syllables", "stress"],
              },
              current: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  syllables: { type: "integer" },
                  stress: { type: "string" },
                },
                required: ["text", "syllables", "stress"],
              },
            },
            required: ["source", "current"],
          },
          issue: { type: "string" },
          alternatives: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                syllables: { type: "integer" },
                stress: { type: "string" },
                match: {
                  type: "string",
                  enum: ["exact", "close", "compressed", "expanded"],
                },
                note: { type: "string" },
              },
              required: ["text", "syllables", "stress", "match"],
            },
          },
          recommendation: { type: "string" },
        },
        required: ["lineIndex", "analysis", "issue", "alternatives", "recommendation"],
      },
    },
  },
  required: ["rhymeWorkshop", "soundWorkshop", "rhythmWorkshop"],
};

// ============================================================================
// Fallback Response Generator
// ============================================================================

/**
 * Generate a basic fallback response when LLM fails
 */
export function generateFallbackRhymeWorkshopResponse(
  params: RhymeWorkshopPromptParams
): {
  rhymeWorkshop: never[];
  soundWorkshop: never[];
  rhythmWorkshop: {
    lineIndex: number;
    analysis: {
      source: { text: string; syllables: number; stress: string };
      current: { text: string; syllables: number; stress: string };
    };
    issue: string;
    alternatives: never[];
    recommendation: string;
  }[];
} {
  const { lineIndex, sourceLine, currentTranslation, sourceLineAnalysis, currentLineAnalysis } =
    params;

  return {
    rhymeWorkshop: [],
    soundWorkshop: [],
    rhythmWorkshop: [
      {
        lineIndex,
        analysis: {
          source: {
            text: sourceLine,
            syllables: sourceLineAnalysis?.syllableCount ?? 0,
            stress: sourceLineAnalysis?.stressPattern ?? "unknown",
          },
          current: {
            text: currentTranslation,
            syllables: currentLineAnalysis?.syllableCount ?? 0,
            stress: currentLineAnalysis?.stressPattern ?? "unknown",
          },
        },
        issue:
          "Unable to generate detailed suggestions. Try adjusting your translation to match the source's rhythm more closely.",
        alternatives: [],
        recommendation:
          "Focus on matching the syllable count of the source line.",
      },
    ],
  };
}
