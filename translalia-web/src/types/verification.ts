/**
 * Verification system types for two-track quality assessment
 * Track A: Internal grading (never shown to users)
 * Track B: Contextual notes (educational, user-facing)
 */

export interface VerificationDimensions {
  semantic_accuracy: number; // 0-10: Literal meaning preserved
  cultural_fidelity: number; // 0-10: Idioms, references handled appropriately
  rhythm_prosody: number; // 0-10: Rhythm/sound patterns (if requested)
  register_tone: number; // 0-10: Formal/informal alignment
  dialect_preservation: number; // 0-10: Non-standard forms respected
  option_quality: number; // 0-10: Were generated choices actually good?
}

export interface VerificationReasoning {
  dimension: keyof VerificationDimensions;
  score: number;
  reasoning: string;
  examples?: string[];
}

export interface TrackAGrade {
  overall_score: number; // 0-10: Weighted average
  scores: VerificationDimensions;
  detailed_reasoning: VerificationReasoning[];
  issues: string[]; // Critical problems identified
  strengths: string[]; // What worked well
  model_used: string;
  graded_at: string;
}

export interface TrackAStatus {
  graded: boolean;
  gradedAt: string;
  auditId: string; // Links to prompt_audits table
  summary?: {
    overall: number;
    dimensions: VerificationDimensions;
  };
}

export interface TrackBContext {
  contextGenerated: boolean;
  notes: string[]; // Educational explanations
  generatedAt?: string;
}

export interface LineVerification {
  trackA?: TrackAStatus;
  trackB?: TrackBContext;
}

// Word option structure for verification reference
export interface WordOptionForVerification {
  source: string;
  order: number;
  options: string[];
  pos?: string;
}

// Selection structure for verification
export interface SelectionForVerification {
  source: string;
  target: string;
  order: number;
}

// Extend existing WorkshopLine type (will be merged with existing definition)
export interface WorkshopLineWithVerification {
  original: string;
  translated: string;
  selections: Array<{
    source: string;
    target: string;
    order: number;
  }>;
  completedAt: string;
  word_options?: WordOptionForVerification[]; // Store for verification reference
  verification?: LineVerification; // NEW
}
