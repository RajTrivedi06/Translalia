import type { Chunk } from "@/lib/poem/chunkDetection";
import type { LineTranslationVariant } from "./lineTranslation";

export type TranslationJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type TranslationChunkStatus =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

// Legacy export for backward compatibility during migration
export type TranslationStanzaStatus = TranslationChunkStatus;

/**
 * Error classification for transient vs permanent failures
 */
export type ErrorCode =
  | "timeout"
  | "rate_limit"
  | "server_error"
  | "model_not_found"
  | "validation_error"
  | "auth_error"
  | "unknown";

/**
 * Detailed error information for a chunk
 */
export interface ErrorDetails {
  code: ErrorCode;
  timestamp: number;
  retryable: boolean;
  message: string;
}

/**
 * Translated line stored in chunk results
 */
export interface TranslatedLine {
  line_number: number;
  original_text: string;
  translations: LineTranslationVariant[];
  model_used?: string;
  updated_at?: number;
}

/**
 * State tracking for a single chunk during translation
 */
export interface TranslationChunkState {
  chunkIndex: number;
  status: TranslationChunkStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  error_details?: ErrorDetails;
  linesProcessed: number;
  totalLines: number;
  lastLineTranslated?: number;
  /** Retry tracking for Feature 7 */
  retries?: number;
  maxRetries?: number;
  /** Backoff tracking: timestamp when chunk becomes eligible for retry (Feature 7) */
  nextRetryAt?: number;
  /** Error history for debugging (Feature 9) */
  error_history?: Array<{
    timestamp: number;
    error: string;
    code: ErrorCode;
    retryable: boolean;
  }>;
  /** Translated lines for persistence (Feature 8) */
  lines?: TranslatedLine[];
  /** Fallback mode flag (Feature 9) */
  fallback_mode?: boolean;
}

// Legacy export for backward compatibility during migration
export interface TranslationStanzaState {
  stanzaIndex: number;
  status: TranslationStanzaStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  error_details?: ErrorDetails;
  linesProcessed: number;
  totalLines: number;
  lastLineTranslated?: number;
  retries?: number;
  maxRetries?: number;
  nextRetryAt?: number;
  error_history?: Array<{
    timestamp: number;
    error: string;
    code: ErrorCode;
    retryable: boolean;
  }>;
  lines?: TranslatedLine[];
  fallback_mode?: boolean;
}

/**
 * Processing status aggregates
 */
export interface ProcessingStatus {
  completed: number;
  processing: number;
  queued: number;
  failed: number;
}

/**
 * Cost tracking metadata (Feature 7 Optional)
 */
export interface CostMetadata {
  totalTokens: number;
  estimatedCost: number;
  costPerChunk: Record<number, number>;
  // Legacy field for backward compatibility
  costPerStanza?: Record<number, number>;
}

/**
 * Main translation job state
 */
export interface TranslationJobState {
  jobId: string;
  version: number;
  status: TranslationJobStatus;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  processingTimeMs?: number;
  maxConcurrent: number;
  maxChunksPerTick: number;
  queue: number[];
  active: number[];
  chunks: Record<number, TranslationChunkState>;
  lastError?: string;
  /** Feature 8: Full poem text for context */
  full_poem?: string;
  /** Feature 8: User's guide preferences */
  guide_preferences?: Record<string, unknown>;
  /** Feature 8: Total chunk count */
  total_chunks?: number;
  /** Feature 8: Processing status aggregates */
  processing_status?: ProcessingStatus;
  /** Feature 7 Optional: Cost tracking */
  costMetadata?: CostMetadata;
  /** Feature 7 Optional: Rate limit status */
  rateLimitStatus?: {
    remaining: number;
    limit: number;
    reset: number;
  };
  // Legacy fields for backward compatibility
  maxStanzasPerTick?: number;
  stanzas?: Record<number, TranslationStanzaState>;
  total_stanzas?: number;
}

export interface TranslationJobProgressCounts {
  total: number;
  completed: number;
  processing: number;
  queued: number;
  pending: number;
  failed: number;
}

export interface TranslationJobProgressSummary {
  jobId: string;
  status: TranslationJobStatus;
  progress: TranslationJobProgressCounts;
  chunks: Record<number, TranslationChunkState>;
  updatedAt: number;
  // Legacy field for backward compatibility
  stanzas?: Record<number, TranslationStanzaState>;
}

export interface TranslationTickResult {
  job: TranslationJobState;
  startedChunks: number[];
  completedChunks: number[];
  hasWorkRemaining: boolean;
  // Legacy fields for backward compatibility
  startedStanzas?: number[];
  completedStanzas?: number[];
}

export interface TranslationJobContext {
  threadId: string;
  poem: string;
  chunks: Chunk[];
  // Legacy field for backward compatibility
  stanzas?: Chunk[];
}
