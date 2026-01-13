/**
 * Build a translator personality profile from user's guide answers.
 * This becomes the foundation of all translation prompts.
 *
 * HARDENING (Method 2): Simplified personality to core fields only.
 * Legacy fields (literalness, register, sacred_terms, forbidden_terms)
 * are removed to reduce prompt noise and simplify context hash computation.
 * The archetype-based recipe system now handles variant diversity.
 */
export interface TranslatorPersonality {
  domain: string; // from translationZone
  purpose: string; // from translationIntent
  priority: "accuracy" | "naturalness" | "expressiveness";
  source_language_variety?: string | null;
  source_language_notes?: string;

  // LEGACY FIELDS (kept for backward compatibility but not actively used in prompts)
  // These are computed but no longer injected into translation prompts.
  /** @deprecated - Legacy field, not used in Method 2 prompts */
  literalness: number;
  /** @deprecated - Legacy field, not used in Method 2 prompts */
  register: string[];
  /** @deprecated - Legacy field, not used in Method 2 prompts */
  sacred_terms: string[];
  /** @deprecated - Legacy field, not used in Method 2 prompts */
  forbidden_terms: string[];
  /** @deprecated - Legacy field, not used in Method 2 prompts */
  approach_summary: string;
  /** @deprecated - Legacy field, not used in Method 2 prompts */
  creativity_level: "conservative" | "moderate" | "bold";
}

type GuideAnswersLike = {
  translationZone?: unknown;
  translationIntent?: unknown;
  sourceLanguageVariety?: unknown;
  stance?: { closeness?: unknown } | null;
  style?: { vibes?: unknown } | null;
  policy?: { must_keep?: unknown; no_go?: unknown } | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function closenessToNumber(closeness: unknown): number {
  if (typeof closeness === "number" && Number.isFinite(closeness)) {
    return clamp(closeness, 0, 100);
  }
  if (typeof closeness === "string") {
    const key = closeness.trim().toLowerCase();
    if (key === "close") return 80;
    if (key === "in_between") return 50;
    if (key === "natural") return 25;
  }
  return 50;
}

/**
 * Build a personality object from guide answers.
 */
export function buildTranslatorPersonality(
  guideAnswers: unknown
): TranslatorPersonality {
  const ga = (guideAnswers ?? {}) as GuideAnswersLike;

  // Extract preferences
  const zone = asString(ga.translationZone);
  const intent = asString(ga.translationIntent);
  const sourceVarietyRaw = asString(ga.sourceLanguageVariety);
  const source_language_variety = sourceVarietyRaw.length
    ? sourceVarietyRaw
    : null;
  const source_language_notes = buildSourceLanguageNotes(
    source_language_variety
  );
  const literalness = closenessToNumber(ga.stance?.closeness);
  const vibes = asStringArray(ga.style?.vibes);
  const mustKeep = asStringArray(ga.policy?.must_keep);
  const noGo = asStringArray(ga.policy?.no_go);

  // Determine creativity level based on literalness
  let creativity_level: TranslatorPersonality["creativity_level"];
  if (literalness >= 70) {
    creativity_level = "conservative"; // Stay close to source
  } else if (literalness >= 40) {
    creativity_level = "moderate"; // Balance
  } else {
    creativity_level = "bold"; // Prioritize target language
  }

  // Determine priority based on domain and vibes
  const zoneLower = zone.toLowerCase();
  const vibeLower = vibes.map((v) => v.toLowerCase());

  const hasTechnical =
    zoneLower.includes("technical") ||
    zoneLower.includes("academic") ||
    zoneLower.includes("scientific") ||
    vibeLower.some((v) =>
      ["academic", "precise", "technical", "scientific"].includes(v)
    );

  const hasPoetic =
    zoneLower.includes("poetic") ||
    zoneLower.includes("lyrical") ||
    zoneLower.includes("artistic") ||
    vibeLower.some((v) =>
      ["poetic", "artistic", "lyrical", "expressive"].includes(v)
    );

  let priority: TranslatorPersonality["priority"];
  if (hasTechnical) {
    priority = "accuracy";
  } else if (hasPoetic) {
    priority = "expressiveness";
  } else {
    priority = "naturalness";
  }

  // Build approach summary
  const parts: string[] = [];
  if (zone) parts.push(`${zone} translator`);
  if (literalness >= 70) {
    parts.push("prioritizing fidelity to source");
  } else if (literalness >= 40) {
    parts.push("balancing accuracy and naturalness");
  } else {
    parts.push("prioritizing target language flow");
  }
  if (vibes.length > 0) {
    parts.push(`with ${vibes.slice(0, 2).join(", ")} register`);
  }
  const approach_summary = parts.join(", ");

  return {
    domain: zone || "general translation",
    purpose: intent || "accurate translation",
    literalness,
    register: vibes,
    sacred_terms: mustKeep,
    forbidden_terms: noGo,
    approach_summary,
    creativity_level,
    priority,
    source_language_variety,
    source_language_notes,
  };
}

function buildSourceLanguageNotes(variety: string | null): string {
  if (!variety) return "Source language variety not specified.";

  const normalized = variety.trim().toLowerCase();

  // English dialects / registers
  if (normalized.includes("scouse") || normalized.includes("liverpool")) {
    return "Source is Scouse English (Liverpool dialect) — watch for colloquialisms and regional expressions; don’t treat them as mistakes.";
  }
  if (normalized.includes("cockney") || normalized.includes("east london")) {
    return "Source is Cockney English — be aware of rhyming slang and dialect vocabulary.";
  }
  if (normalized.includes("scots") || normalized.includes("scottish")) {
    return "Source is Scots/Scottish English — note distinctive vocabulary and grammar; preserve regional flavor where appropriate.";
  }
  if (normalized.includes("geordie") || normalized.includes("newcastle")) {
    return "Source is Geordie English (Newcastle) — watch for dialect-specific vocabulary and idioms.";
  }

  // Indo-Aryan / Himalaya
  if (normalized.includes("garhwali")) {
    return "Source is Garhwali — preserve regional cultural references and idioms; consider that unfamiliar phrases may be variety-specific.";
  }
  if (normalized.includes("bhojpuri")) {
    return "Source is Bhojpuri — treat variety-specific forms as intentional; preserve regional flavor where possible.";
  }

  // Portuguese varieties
  if (normalized.includes("brazilian") && normalized.includes("portuguese")) {
    return "Source is Brazilian Portuguese — note vocabulary/usage differences vs European Portuguese; preserve Brazilian register.";
  }
  if (
    normalized.includes("european portuguese") ||
    normalized.includes("portugal")
  ) {
    return "Source is European Portuguese — note differences vs Brazilian Portuguese; preserve European register.";
  }

  // Spanish varieties
  if (normalized.includes("argentine") || normalized.includes("rioplatense")) {
    return "Source is Argentine Spanish (Rioplatense) — watch for regional vocabulary and voseo-related forms.";
  }
  if (normalized.includes("mexican") || normalized.includes("méxico")) {
    return "Source is Mexican Spanish — watch for region-specific vocabulary and idioms.";
  }
  if (normalized.includes("castilian") || normalized.includes("peninsular")) {
    return "Source is Peninsular/Castilian Spanish — watch for region-specific vocabulary and forms.";
  }

  // Arabic varieties
  if (
    normalized.includes("msa") ||
    normalized.includes("modern standard arabic")
  ) {
    return "Source is Modern Standard Arabic — formal/literary register; preserve formality and rhetorical structure.";
  }
  if (normalized.includes("egyptian") && normalized.includes("arabic")) {
    return "Source is Egyptian Arabic — treat dialect vocabulary and idioms as intentional; preserve colloquial texture.";
  }
  if (normalized.includes("levantine") && normalized.includes("arabic")) {
    return "Source is Levantine Arabic — treat dialect vocabulary and idioms as intentional; preserve regional flavor.";
  }

  // Chinese varieties
  if (normalized.includes("cantonese")) {
    return "Source is Cantonese — treat Cantonese-specific vocabulary/grammar as intentional; preserve regional flavor.";
  }
  if (normalized.includes("mandarin") || normalized.includes("putonghua")) {
    return "Source is Mandarin Chinese — standard register; preserve tone and idioms.";
  }

  // Historical English
  if (
    normalized.includes("old english") ||
    normalized.includes("anglo-saxon")
  ) {
    return "Source is Old English — preserve archaic tone and meaning; avoid modernizing away historical flavor.";
  }
  if (normalized.includes("middle english")) {
    return "Source is Middle English — preserve archaic tone; be cautious with historically shifting meanings.";
  }
  if (
    normalized.includes("early modern") ||
    normalized.includes("shakespeare")
  ) {
    return "Source is Early Modern English — preserve archaic pronouns/forms and rhetorical style where appropriate.";
  }

  // Register-based fallback
  if (
    normalized.includes("formal") ||
    normalized.includes("literary") ||
    normalized.includes("high register")
  ) {
    return `Source uses a formal/literary register (${variety}) — maintain elevated language and avoid flattening tone.`;
  }
  if (
    normalized.includes("informal") ||
    normalized.includes("colloquial") ||
    normalized.includes("casual")
  ) {
    return `Source uses an informal/colloquial register (${variety}) — preserve conversational tone and idioms.`;
  }

  return `Source is ${variety} — be attentive to dialect-specific expressions and cultural context; if something seems “off”, consider it may be variety-specific.`;
}

/**
 * Build variant definitions adapted to user's personality.
 */
export function buildVariantDefinitions(
  personality: TranslatorPersonality
): string {
  const { priority, creativity_level, domain, register } = personality;

  // Base definitions
  let variant1_label = "MOST FAITHFUL";
  let variant1_desc = "Preserve source structure exactly";
  let variant2_label = "NATURALLY FLOWING";
  let variant2_desc = "Balance accuracy with target language flow";
  let variant3_label = "MOST EXPRESSIVE";
  let variant3_desc = "Prioritize target language naturalness";

  // Adapt based on priority
  if (priority === "accuracy") {
    variant1_label = "MOST LITERAL (Scientific)";
    variant1_desc = "Use most literal scientific/technical terms";
    variant2_label = "NATURALLY TECHNICAL";
    variant2_desc = "Technical accuracy with natural phrasing";
    variant3_label = "CREATIVELY TECHNICAL";
    variant3_desc = "Creative within domain, maintain technical register";
  } else if (priority === "expressiveness") {
    variant1_label = "FAITHFULLY POETIC";
    variant1_desc = "Preserve poetic structure and imagery";
    variant2_label = "NATURALLY POETIC";
    variant2_desc = "Balance source meaning with poetic flow";
    variant3_label = "FREELY POETIC";
    variant3_desc = "Poetic liberty, prioritize beauty and impact";
  }

  // Adapt constraints based on creativity level
  const constraints =
    creativity_level === "conservative"
      ? "Stay very close to source word order and structure"
      : creativity_level === "moderate"
      ? "Slight structural adjustments allowed for naturalness"
      : "Significant restructuring allowed for target language idioms";

  const sacred =
    personality.sacred_terms.length > 0
      ? `✓ Use these key terms when possible: ${personality.sacred_terms.join(
          ", "
        )}`
      : "";
  const forbidden =
    personality.forbidden_terms.length > 0
      ? `✗ NEVER use: ${personality.forbidden_terms.join(", ")}`
      : "";

  return `
═══════════════════════════════════════════════════════════════
VARIANT REQUIREMENTS
═══════════════════════════════════════════════════════════════
Generate 3 distinct translation variants that ALL honor your translator personality.

Variant 1: ${variant1_label}
${variant1_desc}
${constraints}
${register.length > 0 ? `- Use ${register[0]} register` : ""}

Variant 2: ${variant2_label}
${variant2_desc}
Natural phrasing in target language
${register.length > 0 ? `- Maintain ${register.join(", ")} tone` : ""}

Variant 3: ${variant3_label}
${variant3_desc}
Most creative interpretation allowed
${register.length > 0 ? `- Still respect ${register.join(", ")} context` : ""}

CRITICAL: ALL variants must:
${sacred}
${forbidden}
✓ Be DISTINCTLY different from each other
✓ Honor the ${domain} domain
✓ Reflect the translator personality defined above
`.trim();
}

/**
 * Build examples adapted to user's domain.
 */
export function buildDomainExamples(
  personality: TranslatorPersonality,
  sourceLanguage: string,
  targetLanguage: string
): string {
  const { priority } = personality;
  if (priority === "accuracy") {
    return buildTechnicalExamples(sourceLanguage, targetLanguage);
  }
  if (priority === "expressiveness") {
    return buildPoeticExamples(sourceLanguage, targetLanguage);
  }
  return buildGeneralExamples(sourceLanguage, targetLanguage);
}

function buildTechnicalExamples(source: string, target: string): string {
  return `
═══════════════════════════════════════════════════════════════
EXAMPLES - Technical/Scientific Domain
═══════════════════════════════════════════════════════════════
Example: Technical Context (${source} → ${target})
Source: "The moon circles the earth"

❌ BAD (too generic):
"La luna da vueltas a la tierra"
"La luna rodea la tierra"
"La luna gira alrededor de la tierra"
(All generic, not technical enough.)

✅ GOOD (technical domain):
Variant 1: "La luna orbita la tierra"
- Uses scientific term "orbita"
- Literal structure, technical register

Variant 2: "La luna describe órbita alrededor de la tierra"
- Natural scientific phrasing
- Technical but fluent

Variant 3: "Nuestro satélite natural traza su órbita terrestre"
- Creative: "satélite natural" for moon
- Still maintains scientific register

Notice: ALL use technical vocabulary, none are colloquial.
`.trim();
}

function buildPoeticExamples(source: string, target: string): string {
  return `
═══════════════════════════════════════════════════════════════
EXAMPLES - Poetic/Lyrical Domain
═══════════════════════════════════════════════════════════════
Example: Poetic Context (${source} → ${target})
Source: "The stars shine bright"

❌ BAD (too literal, not poetic):
"Las estrellas brillan brillante"
"Las estrellas brillan con brillo"
"Las estrellas están brillantes"
(All too literal, miss poetic register.)

✅ GOOD (poetic domain):
Variant 1: "Las estrellas brillan radiantes"
- Faithful to source, elevated adjective

Variant 2: "Luceros resplandecen en lo alto"
- "Luceros" (poetic term)
- More natural poetic flow

Variant 3: "Titilan astros en el firmamento"
- Highly poetic vocabulary
- "Titilan" (twinkle), "firmamento" (heavens)

Notice: ALL use elevated/poetic register.
`.trim();
}

function buildGeneralExamples(source: string, target: string): string {
  return `
═══════════════════════════════════════════════════════════════
EXAMPLES - General Translation
═══════════════════════════════════════════════════════════════
Example: Everyday Context (${source} → ${target})
Source: "The sun rises in the morning"

Variant 1: "El sol sale por la mañana"
- Most literal, standard structure

Variant 2: "El sol se levanta en la mañana"
- Slightly more natural phrasing

Variant 3: "Amanece cuando surge el sol"
- Idiomatic restructuring, most natural
`.trim();
}
