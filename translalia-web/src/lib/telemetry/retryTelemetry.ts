/**
 * ISS-016: Retry Telemetry Helper
 * 
 * Provides structured logging and counters for retry operations across the codebase.
 * All logging is gated by DEBUG_RETRY=1 to avoid noise in production.
 */

export interface RetryTelemetry {
  retries: {
    attempts: number;
    retries: number; // attempts > 1
    totalDelayMs: number;
    lastErrorReason?: string;
    byLayer: Record<string, {
      attempts: number;
      retries: number;
      totalDelayMs: number;
    }>;
  };
}

export interface RetryTelemetryCollector {
  recordRetry(params: {
    layer: string;
    operation: string;
    attempt: number;
    maxAttempts: number;
    reason?: string;
    elapsedMs?: number;
    delayMs?: number;
  }): void;
}

/**
 * Create a retry telemetry collector that updates counters and logs (if enabled)
 */
export function createRetryTelemetryCollector(
  telemetry?: RetryTelemetry
): RetryTelemetryCollector {
  const debugRetry = process.env.DEBUG_RETRY === "1";
  
  // Initialize telemetry if provided
  if (telemetry && !telemetry.retries) {
    telemetry.retries = {
      attempts: 0,
      retries: 0,
      totalDelayMs: 0,
      byLayer: {},
    };
  }

  return {
    recordRetry(params) {
      const { layer, operation, attempt, maxAttempts, reason, elapsedMs, delayMs } = params;
      
      // Update counters (always, if telemetry provided)
      if (telemetry?.retries) {
        telemetry.retries.attempts++;
        if (attempt > 1) {
          telemetry.retries.retries++;
        }
        if (delayMs) {
          telemetry.retries.totalDelayMs += delayMs;
        }
        if (reason) {
          telemetry.retries.lastErrorReason = reason;
        }
        
        // Per-layer counters
        if (!telemetry.retries.byLayer[layer]) {
          telemetry.retries.byLayer[layer] = {
            attempts: 0,
            retries: 0,
            totalDelayMs: 0,
          };
        }
        const layerStats = telemetry.retries.byLayer[layer];
        layerStats.attempts++;
        if (attempt > 1) {
          layerStats.retries++;
        }
        if (delayMs) {
          layerStats.totalDelayMs += delayMs;
        }
      }

      // Logging (only if enabled)
      if (debugRetry) {
        const isRetry = attempt > 1;
        const prefix = isRetry ? "[RETRY]" : "[RETRY_ATTEMPT]";
        const logParts = [
          prefix,
          `layer=${layer}`,
          `operation=${operation}`,
          `attempt=${attempt}/${maxAttempts}`,
        ];
        
        if (elapsedMs !== undefined) {
          logParts.push(`elapsedMs=${elapsedMs}`);
        }
        if (delayMs !== undefined) {
          logParts.push(`delayMs=${delayMs}`);
        }
        if (reason) {
          logParts.push(`reason=${reason.slice(0, 100)}`); // Truncate long reasons
        }
        
        console.log(logParts.join(" "));
      }
    },
  };
}

/**
 * No-op collector for when telemetry is not available
 */
export const noOpRetryTelemetry: RetryTelemetryCollector = {
  recordRetry() {
    // No-op
  },
};
