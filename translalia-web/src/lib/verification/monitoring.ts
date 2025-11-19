/**
 * Performance monitoring for verification system
 * Tracks latency, failures, and usage patterns
 */

interface VerificationMetric {
  timestamp: number;
  operation: "grade" | "context";
  duration: number;
  success: boolean;
  errorCode?: string;
  userId: string;
  metadata?: Record<string, any>;
}

// In-memory metrics buffer (in production, send to monitoring service)
const metricsBuffer: VerificationMetric[] = [];
const MAX_BUFFER_SIZE = 1000;

/**
 * Record a verification operation metric
 */
export function recordMetric(metric: VerificationMetric) {
  metricsBuffer.push(metric);

  // Prevent memory leak
  if (metricsBuffer.length > MAX_BUFFER_SIZE) {
    metricsBuffer.shift();
  }

  // Log slow operations
  if (metric.duration > 5000) {
    console.warn("[verification-monitoring] Slow operation detected:", {
      operation: metric.operation,
      duration: metric.duration,
      success: metric.success,
    });
  }

  // In production, send to monitoring service
  if (process.env.NODE_ENV === "production") {
    // Example: sendToDatadog(metric);
    // Example: sendToNewRelic(metric);
  }
}

/**
 * Get recent metrics summary
 */
export function getMetricsSummary(minutes: number = 60) {
  const cutoff = Date.now() - minutes * 60 * 1000;
  const recentMetrics = metricsBuffer.filter((m) => m.timestamp > cutoff);

  const total = recentMetrics.length;
  const successful = recentMetrics.filter((m) => m.success).length;
  const failed = total - successful;

  const durations = recentMetrics.map((m) => m.duration);
  const avgDuration =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

  const p95Duration =
    durations.length > 0
      ? durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]
      : 0;

  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? (successful / total) * 100 : 0,
    avgDuration: Math.round(avgDuration),
    p95Duration: Math.round(p95Duration),
    period: `${minutes}m`,
  };
}

/**
 * Create a performance timer
 */
export function createTimer() {
  const start = Date.now();

  return {
    stop: () => Date.now() - start,
  };
}
