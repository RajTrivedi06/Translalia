/**
 * Centralized error handling for verification system
 * Ensures graceful degradation and proper logging
 */

export enum VerificationErrorCode {
  RATE_LIMIT = "RATE_LIMIT_EXCEEDED",
  OPENAI_ERROR = "OPENAI_ERROR",
  PARSE_ERROR = "PARSE_ERROR",
  THREAD_NOT_FOUND = "THREAD_NOT_FOUND",
  LINE_INCOMPLETE = "LINE_INCOMPLETE",
  NETWORK_ERROR = "NETWORK_ERROR",
  UNKNOWN = "UNKNOWN_ERROR",
}

export class VerificationError extends Error {
  code: VerificationErrorCode;
  statusCode: number;
  metadata?: Record<string, any>;

  constructor(
    code: VerificationErrorCode,
    message: string,
    statusCode: number = 500,
    metadata?: Record<string, any>
  ) {
    super(message);
    this.name = "VerificationError";
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
  }
}

/**
 * Handle OpenAI API errors with appropriate fallbacks
 */
export function handleOpenAIError(error: any): VerificationError {
  console.error("[verification] OpenAI error:", error);

  if (error.status === 429) {
    return new VerificationError(
      VerificationErrorCode.RATE_LIMIT,
      "OpenAI rate limit exceeded",
      429,
      { provider: "openai" }
    );
  }

  if (error.status === 503) {
    return new VerificationError(
      VerificationErrorCode.OPENAI_ERROR,
      "OpenAI service temporarily unavailable",
      503
    );
  }

  return new VerificationError(
    VerificationErrorCode.OPENAI_ERROR,
    "Failed to generate verification",
    500,
    { originalError: error.message }
  );
}

/**
 * Determine if an error should block user progress
 * Verification errors should NEVER block translation workflow
 */
export function isBlockingError(error: VerificationError): boolean {
  // Verification failures should never block users
  return false;
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: VerificationError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...error.metadata,
    },
  };
}

/**
 * Log error with context
 */
export function logVerificationError(
  context: string,
  requestId: string,
  error: Error | VerificationError,
  metadata?: Record<string, any>
) {
  const logData: Record<string, any> = {
    context,
    requestId,
    error: error.message,
    stack: error.stack,
    ...metadata,
  };

  if (error instanceof VerificationError) {
    logData.code = error.code;
    logData.statusCode = error.statusCode;
    logData.metadata = error.metadata;
  }

  console.error("[verification-error]", JSON.stringify(logData));

  // In production, send to monitoring service
  if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
    // Example: Sentry.captureException(error, { extra: logData });
  }
}
