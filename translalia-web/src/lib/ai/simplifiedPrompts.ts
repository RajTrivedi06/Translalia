/**
 * Simplified Translation Prompts (Phase 1: Additive Only)
 *
 * These constants and builders replace the archetype-based recipe system
 * (Essence Cut, Prismatic Reimagining, World & Voice Transposition) with
 * Matthew's simpler, source-text-centered instructions.
 *
 * Phase 1: Defined but not yet wired into the pipeline.
 * Existing code in workshopPrompts.ts, variantRecipes.ts, and regen.ts
 * remains untouched.
 */

import type { TranslatorPersonality } from "./translatorPersonality";
import type { TranslationRangeMode } from "./variantRecipes";

// =============================================================================
// 1A: Mode-Specific Variant Instructions (Matthew's exact text)
// =============================================================================

/**
 * Matthew's simplified variant instructions, keyed by translation range mode.
 * These replace the archetype MUST rules, lens configurations, and divergence rules.
 *
 * DO NOT rephrase or "improve" these — they are the client's exact words.
 */
export const SIMPLIFIED_VARIANT_INSTRUCTIONS: Record<
  TranslationRangeMode,
  string
> = {
  focused: `#1 should be close: not necessarily word for word, but a translation that sticks close to the verbal texture of the source
#2 should be an alternative close translation using different words. Please make sure that every significant word in this translation is different from #1. I want to see alternatives.
#3 should be another alternative close translation using different words. Please make sure that every significant word in this translation is different from #1 and #2. I want to see more alternatives.`,

  balanced: `#1 should be close: not necessarily word for word, but a translation that sticks close to the verbal texture of the source
#2 should be an alternative close translation using different words. Please make sure that every significant word in this translation is different from #1. I want to see alternatives.
#3 should re-write the poem to bring out signifying possibilities that have not been recognised in #1 or #2.`,

  adventurous: `#1 should be close: not necessarily word for word, but a translation that sticks close to the verbal texture of the source.
#2 should re-write the poem to bring out signifying possibilities that have not been recognised in #1.
#3 should respond more freely, opening up imaginative possibilities that have not been recognised in #1 or #2.`,
} as const;

// =============================================================================
// 1B: Simplified Variant Descriptions for Regen
// =============================================================================

/**
 * Short descriptions of each variant's role, per mode.
 * Used in regeneration prompts to replace archetype references like
 * "prismatic_reimagining" and "world_voice_transposition".
 */
export const SIMPLIFIED_VARIANT_DESCRIPTIONS: Record<
  TranslationRangeMode,
  Record<"A" | "B" | "C", string>
> = {
  focused: {
    A: "A close translation that sticks close to the verbal texture of the source",
    B: "An alternative close translation using different words from variant A",
    C: "Another alternative close translation using different words from variants A and B",
  },
  balanced: {
    A: "A close translation that sticks close to the verbal texture of the source",
    B: "An alternative close translation using different words from variant A",
    C: "A rewrite that brings out signifying possibilities not recognised in variants A or B",
  },
  adventurous: {
    A: "A close translation that sticks close to the verbal texture of the source",
    B: "A rewrite that brings out signifying possibilities not recognised in variant A",
    C: "A freer response that opens up imaginative possibilities not recognised in variants A or B",
  },
} as const;

// =============================================================================
// 1C: Simplified System Prompt Builder
// =============================================================================

/**
 * Builds the simplified system prompt for the translation LLM call.
 * Replaces the archetype-heavy system prompt (5-step self-check, archetype
 * enforcement, metadata field bans) with minimal output constraints.
 */
export function buildSimplifiedSystemPrompt(): string {
  return [
    "You are a poetry translator assisting in an educational exercise.",
    "Respond ONLY with valid JSON in this exact format:",
    '{ "variants": [{ "label": "A", "text": "..." }, { "label": "B", "text": "..." }, { "label": "C", "text": "..." }] }',
    "Do not include any explanation, commentary, or additional fields.",
    "Each variant text should contain only the translated line(s), no labels or prefixes.",
  ].join("\n");
}

// =============================================================================
// 1D: Simplified User Prompt Builder
// =============================================================================

/**
 * Builds the simplified user prompt for the translation LLM call.
 * Replaces buildRecipeAwarePrismaticPrompt() — same essential context elements
 * (language, variety notes, intent/zone, source text, poem context) but
 * without archetype blocks, lens configs, MUST rules, or divergence rules.
 */
export function buildSimplifiedUserPrompt(params: {
  sourceText: string;
  mode: TranslationRangeMode;
  personality: TranslatorPersonality;
  currentTranslation?: string;
  context?: string;
}): string {
  const { sourceText, mode, personality, currentTranslation, context } = params;
  const sections: string[] = [];

  // 1. Core task framing (Matthew's preamble)
  sections.push(
    "This is a poetry translation exercise. I would like you to provide me with three alternatives for the following poem."
  );

  // 2. Language context (from TranslatorPersonality: domain maps to zone, purpose maps to intent)
  sections.push(`Domain: ${personality.domain}`);
  sections.push(`Purpose: ${personality.purpose}`);
  sections.push(`Priority: ${personality.priority}`);

  // 3. Source language variety notes (dialect warnings) — preserve if present
  if (
    personality.source_language_variety &&
    personality.source_language_variety.trim().length > 0
  ) {
    const varietyNotes =
      personality.source_language_notes ??
      "Source language variety provided by user.";
    sections.push(
      `\nSource language note: The source text is in ${personality.source_language_variety}.`,
      varietyNotes,
      "Be aware of dialect-/variety-specific expressions and idioms."
    );
  }

  // 4. Broader poem context (for line-by-line translation mode)
  if (context) {
    sections.push(`\nFull poem for context:\n${context}`);
  }

  // 5. Source text
  if (context) {
    sections.push(`\nTranslate this specific line:\n"${sourceText}"`);
  } else {
    sections.push(`\n"${sourceText}"`);
  }

  // 6. Current translation reference (if student has existing work)
  if (currentTranslation) {
    sections.push(
      `Current translation (for reference): "${currentTranslation}"`
    );
  }

  // 7. Mode-specific variant instructions (Matthew's exact text)
  sections.push(`\n${SIMPLIFIED_VARIANT_INSTRUCTIONS[mode]}`);

  // 8. Output format reminder
  sections.push(
    "\nRespond with ONLY the JSON object containing the three variants. No commentary."
  );

  return sections.join("\n");
}

// =============================================================================
// 3: Simplified Regen Prompt Builder
// =============================================================================

/**
 * Builds a simplified regeneration prompt that replaces archetype references
 * with Matthew's simpler variant descriptions.
 *
 * Preserves the structural scaffolding that improves regen quality:
 * - Gate failure reason → targeted constraints
 * - Anti-copy rules (banned first tokens)
 * - Semantic anchors (if provided)
 * - Structural opener targets
 *
 * Removes:
 * - Archetype rules (prismatic_reimagining, world_voice_transposition)
 * - Lens configurations (imagery, voice, sound, syntax)
 * - Stance plan enforcement
 * - Directive references
 *
 * The existing buildRegenPrompt() returns a single string used as the user
 * message (system is always "You are a translation variant generator.").
 * This function matches that contract.
 */
export function buildSimplifiedRegenPrompt(params: {
  label: "A" | "B" | "C";
  mode: TranslationRangeMode;
  lineText: string;
  sourceLanguage: string;
  targetLanguage: string;
  fixedVariants: Array<{ text: string; openerType?: string; signature?: string }>;
  gateReason: string;
  prevLine?: string;
  nextLine?: string;
}): string {
  const {
    label,
    mode,
    lineText,
    sourceLanguage,
    targetLanguage,
    fixedVariants,
    gateReason,
    prevLine,
    nextLine,
  } = params;

  const variantDescription = SIMPLIFIED_VARIANT_DESCRIPTIONS[mode][label];

  return `You are regenerating variant ${label} for a poetry translation line.

FAILURE CONTEXT:
The previous attempt was too similar to other variants.
Reason: ${gateReason}

SOURCE LINE: "${lineText}"
SOURCE LANGUAGE: ${sourceLanguage}
TARGET LANGUAGE: ${targetLanguage}
${prevLine ? `PREVIOUS LINE: "${prevLine}"` : ""}
${nextLine ? `NEXT LINE: "${nextLine}"` : ""}

ROLE OF VARIANT ${label}:
${variantDescription}

EXISTING VARIANTS (DO NOT COPY):
${fixedVariants
  .map(
    (v, i) =>
      `- "${v.text}"${v.openerType ? ` (opener: ${v.openerType})` : ""}`
  )
  .join("\n")}

ANTI-COPY RULES (MANDATORY):
- DO NOT start with the same first 2 words as any existing variant
- MUST be STRUCTURALLY DIFFERENT (not just synonym swaps)
- Make the new version clearly distinct while fulfilling the variant's role

OUTPUT FORMAT (JSON only, no markdown):
{
  "text": "your translation here"
}

CRITICAL: Return ONLY the translation text in the "text" field. No labels, no explanations, no meta-commentary.
Return ONLY valid JSON. No markdown, no explanations.`;
}
