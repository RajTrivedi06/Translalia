/**
 * ISS-012: Safe Sampling Parameters Builder
 * 
 * Builds sampling parameters that are safe for the given model.
 * For GPT-5 models, we don't assume temperature works - we'll test via
 * retry-on-unsupported-param fallback.
 */

export type SamplingParams = Partial<{
  temperature: number;
  top_p: number;
  presence_penalty: number;
  frequency_penalty: number;
  seed: number;
}>;

/**
 * Build safe sampling parameters for a given model.
 * 
 * Conservative approach:
 * - GPT-4 style models: Use existing temperature (0.7 for main-gen, 0.9 for regen)
 * - GPT-5 models: Return empty by default (no params) until verified
 * 
 * When ENABLE_GPT5_SAMPLING_TUNING=1:
 * - Try one candidate param at a time (prefer top_p first if supported, else temperature)
 * - The retry wrapper will catch unsupported params and fallback
 * 
 * @param model - Model name (e.g., "gpt-5-mini", "gpt-4o")
 * @param config - Desired tuning configuration
 * @returns Safe sampling parameters (may be empty for GPT-5)
 */
export function buildSamplingParams(
  model: string,
  config: {
    temperature?: number;
    top_p?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    seed?: number;
  } = {}
): SamplingParams {
  const isGpt5 = model.startsWith("gpt-5");
  const enableGpt5Tuning = process.env.ENABLE_GPT5_SAMPLING_TUNING === "1";
  
  // For non-GPT-5 models, use provided config (defaults to existing behavior)
  if (!isGpt5) {
    const params: SamplingParams = {};
    if (typeof config.temperature === "number") {
      params.temperature = config.temperature;
    }
    if (typeof config.top_p === "number") {
      params.top_p = config.top_p;
    }
    if (typeof config.presence_penalty === "number") {
      params.presence_penalty = config.presence_penalty;
    }
    if (typeof config.frequency_penalty === "number") {
      params.frequency_penalty = config.frequency_penalty;
    }
    if (typeof config.seed === "number") {
      params.seed = config.seed;
    }
    return params;
  }
  
  // For GPT-5 models: conservative default (no params) unless tuning enabled
  if (!enableGpt5Tuning) {
    return {};
  }
  
  // ISS-012: Experimental tuning for GPT-5 (one param at a time)
  // Prefer top_p first (if provided), then temperature, then others
  const params: SamplingParams = {};
  
  // Try top_p first (if provided)
  if (typeof config.top_p === "number") {
    params.top_p = config.top_p;
    return params; // Only one param at a time for safety
  }
  
  // Then temperature (if provided)
  if (typeof config.temperature === "number") {
    params.temperature = config.temperature;
    return params;
  }
  
  // Other params only if explicitly provided (less common)
  if (typeof config.presence_penalty === "number") {
    params.presence_penalty = config.presence_penalty;
    return params;
  }
  
  if (typeof config.frequency_penalty === "number") {
    params.frequency_penalty = config.frequency_penalty;
    return params;
  }
  
  if (typeof config.seed === "number") {
    params.seed = config.seed;
    return params;
  }
  
  return {};
}

/**
 * Check if an error indicates an unsupported parameter.
 * 
 * @param error - Error object from OpenAI API
 * @returns True if error indicates unsupported parameter
 */
export function isUnsupportedParamError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  
  const err = error as { message?: string; error?: { message?: string; code?: string } };
  const message = err.error?.message || err.message || "";
  const code = err.error?.code || "";
  
  // Check for common unsupported parameter error patterns
  const unsupportedPatterns = [
    /unsupported parameter/i,
    /parameter.*not.*supported/i,
    /invalid parameter/i,
    /unknown parameter/i,
    /parameter.*not.*allowed/i,
    /parameter.*not.*valid/i,
  ];
  
  const hasUnsupportedPattern = unsupportedPatterns.some((pattern) =>
    pattern.test(message)
  );
  
  // Also check for specific parameter mentions
  const paramMentions = [
    /temperature/i,
    /top_p/i,
    /presence_penalty/i,
    /frequency_penalty/i,
    /seed/i,
  ];
  
  const hasParamMention = paramMentions.some((pattern) => pattern.test(message));
  
  return hasUnsupportedPattern && hasParamMention;
}

/**
 * Extract which parameter was rejected from error message.
 * 
 * @param error - Error object from OpenAI API
 * @returns Parameter name that was rejected, or null
 */
export function extractRejectedParam(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  
  const err = error as { message?: string; error?: { message?: string } };
  const message = err.error?.message || err.message || "";
  
  const paramPatterns = [
    { pattern: /temperature/i, name: "temperature" },
    { pattern: /top_p/i, name: "top_p" },
    { pattern: /presence_penalty/i, name: "presence_penalty" },
    { pattern: /frequency_penalty/i, name: "frequency_penalty" },
    { pattern: /seed/i, name: "seed" },
  ];
  
  for (const { pattern, name } of paramPatterns) {
    if (pattern.test(message)) {
      return name;
    }
  }
  
  return null;
}
