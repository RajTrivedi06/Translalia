/**
 * ISS-009: Strict JSON Schema for Main-Gen Response
 * 
 * Defines the minimal schema for main-gen (Method 2) responses to prevent
 * extra fields and reduce token bloat. Uses `additionalProperties: false`
 * to enforce strict compliance.
 */

/**
 * JSON Schema for main-gen response format.
 * 
 * This schema matches exactly what the code uses downstream:
 * - anchors: optional array (only if Phase 1 validation is enabled)
 * - variants: required array of exactly 3 variants
 * - Each variant has: label, text, and optional Phase 1 fields
 * 
 * Note: `translation` field is NOT included (backward compat handled in parser, not schema)
 */
export const MAIN_GEN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    anchors: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "concept_en", "source_tokens"],
        properties: {
          id: {
            type: "string",
            pattern: "^[A-Z][A-Z0-9_]*$", // UPPER_SNAKE format
          },
          concept_en: {
            type: "string",
          },
          source_tokens: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
      },
    },
    variants: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "text"],
        properties: {
          label: {
            type: "string",
            enum: ["A", "B", "C"],
          },
          text: {
            type: "string",
            minLength: 1,
          },
          // ISS-011: anchor_realizations is optional if computed locally
          ...(process.env.OMIT_ANCHOR_REALIZATIONS_FROM_PROMPT === "1" ? {} : {
            anchor_realizations: {
              type: "object",
              additionalProperties: {
                type: "string",
              },
            },
          }),
          b_image_shift_summary: {
            type: "string",
          },
          c_world_shift_summary: {
            type: "string",
          },
          c_subject_form_used: {
            type: "string",
            enum: ["we", "you", "third_person", "impersonal", "i"],
          },
        },
      },
    },
  },
  required: ["variants"],
} as const;

/**
 * Check if strict JSON schema is enabled for a given model.
 * 
 * @param model - Model name (e.g., "gpt-5-mini", "gpt-4o")
 * @returns True if strict schema should be used
 */
export function shouldUseStrictSchema(model: string): boolean {
  const enabled = process.env.ENABLE_STRICT_JSON_SCHEMA !== "0"; // Default: enabled
  if (!enabled) return false;

  const allowedModels = process.env.STRICT_JSON_SCHEMA_MODELS
    ? process.env.STRICT_JSON_SCHEMA_MODELS.split(",").map((s) => s.trim())
    : ["gpt-5", "gpt-5-mini", "gpt-5-turbo"]; // Default: GPT-5 family

  // Check if model matches any allowed prefix (e.g., "gpt-5" matches "gpt-5-mini")
  return allowedModels.some((allowed) => model.startsWith(allowed));
}

/**
 * Check if fallback to json_object is enabled.
 * 
 * @returns True if fallback should be attempted on schema errors
 */
export function shouldFallbackToJsonObject(): boolean {
  return process.env.STRICT_SCHEMA_FALLBACK_TO_JSON_OBJECT !== "0"; // Default: enabled
}

/**
 * Check if an error indicates that json_schema is unsupported.
 * 
 * @param error - Error object from OpenAI API call
 * @returns True if error suggests schema is unsupported
 */
export function isSchemaUnsupportedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const errorObj = error as {
    error?: { code?: string; message?: string };
    message?: string;
    status?: number;
  };

  const message = errorObj.error?.message || errorObj.message || "";
  const code = errorObj.error?.code || "";
  const status = errorObj.status;

  // Check for common "unsupported" error patterns
  const unsupportedPatterns = [
    /unsupported.*response_format/i,
    /invalid.*response_format/i,
    /unknown.*response_format/i,
    /json_schema.*not.*supported/i,
    /response_format.*not.*available/i,
  ];

  if (unsupportedPatterns.some((pattern) => pattern.test(message))) {
    return true;
  }

  // Check for specific error codes
  if (code === "invalid_request_error" && status === 400) {
    // Could be schema-related, but not definitive
    return false;
  }

  return false;
}
