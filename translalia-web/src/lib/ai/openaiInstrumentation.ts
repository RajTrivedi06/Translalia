/**
 * OpenAI Call Instrumentation
 *
 * Tracks in-flight concurrency, latency, tokens, retries, and errors
 * for performance investigation.
 */

type CallType = "recipe" | "main-gen" | "align" | "regen";

interface InFlightCall {
  callType: CallType;
  lineIndex?: number;
  stanzaIndex?: number;
  threadId?: string;
  startTime: number;
  requestId?: string;
}

// Global in-flight tracking
let inflightCount = 0;
let maxInflightSeen = 0;
const inflightCalls = new Map<string, InFlightCall>();

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Track an OpenAI call starting
 * 
 * ✅ NOTE: If you see duplicate "[OAI][INFLIGHT] +1" logs for the same line/stanza,
 * this is expected when parallel calls occur (e.g., regen with K>1, parallel chunks).
 * Each call gets a unique requestId and inflightCount is incremented exactly once per call.
 * The counter tracks concurrent calls, not logical operations.
 */
export function trackCallStart(
  callType: CallType,
  metadata?: {
    lineIndex?: number;
    stanzaIndex?: number;
    threadId?: string;
  }
): string {
  const requestId = generateRequestId();
  inflightCount++;
  maxInflightSeen = Math.max(maxInflightSeen, inflightCount);

  const call: InFlightCall = {
    callType,
    lineIndex: metadata?.lineIndex,
    stanzaIndex: metadata?.stanzaIndex,
    threadId: metadata?.threadId,
    startTime: Date.now(),
    requestId,
  };

  inflightCalls.set(requestId, call);

  const logParts = [
    `[OAI][INFLIGHT] +1 -> ${inflightCount} (max=${maxInflightSeen})`,
    `<${callType}>`,
  ];
  if (metadata?.lineIndex !== undefined) {
    logParts.push(`line=${metadata.lineIndex}`);
  }
  if (metadata?.stanzaIndex !== undefined) {
    logParts.push(`stanza=${metadata.stanzaIndex}`);
  }
  if (metadata?.threadId) {
    logParts.push(`thread=${metadata.threadId.slice(0, 8)}`);
  }

  console.log(logParts.join(" "));

  return requestId;
}

/**
 * Track an OpenAI call completing
 */
export function trackCallEnd(
  requestId: string,
  result: {
    status: "ok" | "error";
    latencyMs: number;
    retryCount?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    errorName?: string;
    httpStatus?: number;
    errorMessageShort?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): void {
  const call = inflightCalls.get(requestId);
  if (!call) {
    console.warn(`[OAI][INFLIGHT] Call ${requestId} not found in tracking`);
    return;
  }

  inflightCount--;
  inflightCalls.delete(requestId);

  const logParts = [
    `[OAI][INFLIGHT] -1 -> ${inflightCount}`,
    `<${call.callType}>`,
  ];
  if (call.lineIndex !== undefined) {
    logParts.push(`line=${call.lineIndex}`);
  }
  if (call.stanzaIndex !== undefined) {
    logParts.push(`stanza=${call.stanzaIndex}`);
  }
  console.log(logParts.join(" "));

  // Log detailed call info as JSON for easy parsing
  const logEntry: Record<string, unknown> = {
    ts: Date.now(),
    threadId: call.threadId,
    callType: call.callType,
    lineIndex: call.lineIndex,
    stanzaIndex: call.stanzaIndex,
    model: result.model,
    temperature: result.temperature,
    max_tokens: result.maxTokens,
    requestId,
    latencyMs: result.latencyMs,
    retryCount: result.retryCount ?? 0,
    status: result.status,
  };

  if (result.status === "ok") {
    logEntry.promptTokens = result.promptTokens ?? null;
    logEntry.completionTokens = result.completionTokens ?? null;
    logEntry.totalTokens = result.totalTokens ?? null;
  } else {
    logEntry.errorName = result.errorName ?? null;
    logEntry.httpStatus = result.httpStatus ?? null;
    logEntry.errorMessageShort = result.errorMessageShort ?? null;
  }

  console.log(`[OAI_CALL] ${JSON.stringify(logEntry)}`);
}

/**
 * Get current in-flight stats
 */
export function getInflightStats(): {
  current: number;
  max: number;
} {
  return {
    current: inflightCount,
    max: maxInflightSeen,
  };
}

/**
 * Reset stats (for testing)
 */
export function resetStats(): void {
  inflightCount = 0;
  maxInflightSeen = 0;
  inflightCalls.clear();
}
