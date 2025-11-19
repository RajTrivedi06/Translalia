import { GuideAnswers } from "@/store/guideSlice";

interface WordOption {
  source: string;
  order: number;
  options: string[];
  pos?: string;
}

interface Selection {
  source: string;
  target: string;
  order: number;
}

export interface VerificationPromptParams {
  sourceLine: string;
  sourceLanguage: string;
  targetLanguage: string;
  guideAnswers: GuideAnswers;
  generatedOptions: WordOption[];
  userSelections: Selection[];
  translatedLine: string;
}

/**
 * Builds a comprehensive verification prompt for Track A internal grading
 * This grades the quality of AI-generated options, not the user's choices
 */
export function buildVerificationPrompt(params: VerificationPromptParams) {
  const {
    sourceLine,
    sourceLanguage,
    targetLanguage,
    guideAnswers,
    generatedOptions,
    userSelections,
    translatedLine,
  } = params;

  const systemPrompt = `You are an expert translation evaluator specializing in poetry translation quality assessment.
Your role is to BRUTALLY evaluate the quality of AI-generated translation options, not to judge the student's choices. Focus on whether the AI provided good, culturally-sensitive, linguistically-sound options.

Key principles:
1. Poetry translation has multiple valid approaches - assess if options support this plurality
2. Cultural context matters - evaluate if options respect the source culture
3. Non-standard dialects should be preserved, not standardized
4. Rhythm and prosody are important if the user requested them
5. Register (formal/informal) must match user preferences

Return your assessment as JSON matching this exact schema:
{
  "overall_score": number (0-10),
  "scores": {
    "semantic_accuracy": number (0-10),
    "cultural_fidelity": number (0-10),
    "rhythm_prosody": number (0-10),
    "register_tone": number (0-10),
    "dialect_preservation": number (0-10),
    "option_quality": number (0-10)
  },
  "detailed_reasoning": [
    {
      "dimension": "semantic_accuracy",
      "score": number,
      "reasoning": "string",
      "examples": ["string"]
    }
  ],
  "issues": ["critical problems"],
  "strengths": ["what worked well"],
  "model_used": "string"
}`;

  const userPrompt = `Evaluate this poetry translation generation:

## SOURCE LINE
Language: ${sourceLanguage}
Text: "${sourceLine}"

## TRANSLATED LINE
Language: ${targetLanguage}
Text: "${translatedLine}"

## USER CONTEXT & PREFERENCES
Translation Intent: ${
    guideAnswers.translationIntent ||
    "Not specified"
  }
Translation Zone: ${
    guideAnswers.translationZone ||
    "Not specified"
  }
Target Language Variety: ${
    guideAnswers.targetLanguage?.variety || "Not specified"
  }
Audience: ${guideAnswers.audience?.audience || "Not specified"}
Stance (closeness to source): ${
    guideAnswers.stance?.closeness || "Not specified"
  }
Style Vibes: ${JSON.stringify(
    guideAnswers.style?.vibes || guideAnswers.style_anchors || []
  )}
Translanguaging Allowed: ${
    guideAnswers.translanguaging?.allow ? "Yes" : "Not specified"
  }
Form Preference: ${guideAnswers.form?.line_breaks || "Not specified"}

## AI-GENERATED OPTIONS (What the system offered)
${JSON.stringify(generatedOptions, null, 2)}

## USER SELECTIONS (What the student chose)
${JSON.stringify(userSelections, null, 2)}

---
Evaluate the quality of the AI-generated options across these dimensions:

1. **Semantic Accuracy (0-10)**: Did the options capture the literal meaning? Were there mistranslations?

2. **Cultural Fidelity (0-10)**: Did options handle idioms, cultural references, and context appropriately? Were they culturally sensitive or did they impose target-culture norms?

3. **Rhythm/Prosody (0-10)**: If the user wanted rhythm preserved, did options maintain sound patterns, syllable counts, or poetic flow?

4. **Register/Tone (0-10)**: Did options match the formality level requested? Was informal language kept informal?

5. **Dialect Preservation (0-10)**: If the source uses non-standard dialect, did options preserve this or standardize it? (Standardization is BAD)

6. **Option Quality (0-10)**: Were the 3 options per word genuinely different and useful? Or were they redundant/unhelpful?

Be BRUTAL. A score of 7+ means excellent. 5-6 is acceptable. Below 5 needs serious prompt improvement.

For each dimension, provide:
- A score (0-10)
- Detailed reasoning (2-3 sentences)
- Specific examples from the options

Finally, list:
- Critical issues that hurt translation quality
- Strengths that should be maintained in future generations`;

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}

/**
 * Builds a contextual notes prompt for Track B user-facing explanations
 * This explains translation considerations without judging quality
 */
export interface ContextNotesParams {
  sourceLine: string;
  sourceToken: string;
  options: string[];
  pos?: string;
  guideAnswers: GuideAnswers;
}

export function buildContextNotesPrompt(params: ContextNotesParams) {
  const { sourceLine, sourceToken, options, pos, guideAnswers } = params;

  const systemPrompt = `You are an educational assistant explaining translation choices to poetry students.

Your role is to provide EDUCATIONAL CONTEXT, not to judge which option is "best." Support the principle that multiple translations can be valid.

Guidelines:
- Explain what each option prioritizes (literalness, rhythm, register, etc.)
- Note cultural or linguistic considerations
- Highlight tradeoffs between options
- Use encouraging, non-prescriptive language
- Keep explanations brief (2-3 sentences max per note)

Return JSON: { "considerations": ["note1", "note2"] }`;

  const userPrompt = `Provide educational context for these translation options:

Source Line: "${sourceLine}"
Source Token: "${sourceToken}" ${pos ? `(${pos})` : ""}

Options:
${options.map((opt, i) => `${i + 1}. "${opt}"`).join("\n")}

User's Translation Preferences:
- Intent: ${
    guideAnswers.translationIntent ||
    "Not specified"
  }
- Zone: ${
    guideAnswers.translationZone ||
    "Not specified"
  }
- Stance: ${guideAnswers.stance?.closeness || "Not specified"}

Provide 1-2 brief notes explaining:
- What each option prioritizes (without saying which is "better")
- Any cultural, idiomatic, or linguistic considerations
- What tradeoffs exist between literal and creative choices

Keep it educational and supportive of student agency.`;

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
