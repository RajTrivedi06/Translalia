/**
 * Diagnostic utilities for tracking Vercel performance issues.
 *
 * Usage in any API route:
 *   import { createDiagnostics } from "@/lib/diagnostics";
 *   const diag = createDiagnostics("token-suggestions");
 *   diag.mark("auth-start");
 *   await requireUser();
 *   diag.mark("auth-end");
 *   // ... more code ...
 *   diag.summary(); // Logs all timings
 */

type DiagnosticMark = {
  label: string;
  timestamp: number;
  elapsed: number; // ms since start
};

type DiagnosticsInstance = {
  mark: (label: string) => void;
  error: (label: string, err: unknown) => void;
  summary: () => void;
  getRequestId: () => string;
  getElapsed: () => number;
};

export function createDiagnostics(routeName: string): DiagnosticsInstance {
  const enabled = process.env.ENABLE_DIAGNOSTICS !== "false";

  // If disabled, return no-op functions
  if (!enabled) {
    return {
      mark: () => {},
      error: () => {},
      summary: () => {},
      getRequestId: () => "disabled",
      getElapsed: () => 0,
    };
  }

  const startTime = Date.now();
  const marks: DiagnosticMark[] = [];
  const requestId = Math.random().toString(36).substring(2, 8);

  // Log immediately to show request started
  console.log(
    `[DIAG:${routeName}:${requestId}] ▶️ Request started at ${new Date().toISOString()}`
  );

  return {
    /**
     * Mark a point in time with a label
     */
    mark(label: string) {
      const now = Date.now();
      const elapsed = now - startTime;
      marks.push({ label, timestamp: now, elapsed });
      console.log(
        `[DIAG:${routeName}:${requestId}] 📍 ${label} @ +${elapsed}ms`
      );
    },

    /**
     * Log an error with context
     */
    error(label: string, err: unknown) {
      const elapsed = Date.now() - startTime;
      console.error(
        `[DIAG:${routeName}:${requestId}] ❌ ${label} @ +${elapsed}ms:`,
        err instanceof Error ? err.message : err
      );
    },

    /**
     * Log the final summary with all timings
     */
    summary() {
      const totalTime = Date.now() - startTime;

      // Calculate time between each mark
      const segments: string[] = [];
      for (let i = 1; i < marks.length; i++) {
        const prev = marks[i - 1];
        const curr = marks[i];
        const segmentTime = curr.timestamp - prev.timestamp;
        segments.push(`${prev.label}→${curr.label}: ${segmentTime}ms`);
      }

      console.log(
        `[DIAG:${routeName}:${requestId}] ✅ Complete in ${totalTime}ms\n` +
          `  Breakdown: ${segments.join(" | ")}`
      );

      // Flag slow segments (>500ms)
      for (let i = 1; i < marks.length; i++) {
        const prev = marks[i - 1];
        const curr = marks[i];
        const segmentTime = curr.timestamp - prev.timestamp;
        if (segmentTime > 500) {
          console.warn(
            `[DIAG:${routeName}:${requestId}] ⚠️ SLOW: ${prev.label}→${curr.label} took ${segmentTime}ms`
          );
        }
      }
    },

    /**
     * Get the request ID for correlation
     */
    getRequestId() {
      return requestId;
    },

    /**
     * Get total elapsed time so far
     */
    getElapsed() {
      return Date.now() - startTime;
    },
  };
}

/**
 * Wrapper to time an async operation
 */
export async function timeOperation<T>(
  diag: DiagnosticsInstance,
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  diag.mark(`${label}-start`);
  try {
    const result = await operation();
    diag.mark(`${label}-end`);
    return result;
  } catch (err) {
    diag.error(label, err);
    throw err;
  }
}
