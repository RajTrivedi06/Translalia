/**
 * Aggregated Metrics Collector
 *
 * Collects telemetry events in an in-memory buffer and flushes them
 * as pre-aggregated rows on a periodic interval. This avoids per-request
 * DB writes from hot paths.
 *
 * Designed for Supabase Postgres as a batched/aggregated sink.
 * Gated by ENABLE_SCALABILITY_METRICS env var.
 *
 * Sampling: high-cardinality events are sampled at a configurable rate
 * to keep write volume bounded.
 */

const ENABLED = process.env.ENABLE_SCALABILITY_METRICS === "1";
const FLUSH_INTERVAL_MS = parseInt(
  process.env.METRICS_FLUSH_INTERVAL_MS || "60000",
  10
);
const SAMPLE_RATE = parseFloat(process.env.METRICS_SAMPLE_RATE || "0.1");

interface LatencyBucket {
  count: number;
  totalMs: number;
  maxMs: number;
  errorCount: number;
}

interface TokenBucket {
  count: number;
  promptTokens: number;
  completionTokens: number;
}

interface QueueBucket {
  peakDepth: number;
  peakAge: number;
  reenqueueCount: number;
  lockSkipCount: number;
}

interface AggregationWindow {
  windowStart: number;
  latency: Map<string, LatencyBucket>;
  tokens: Map<string, TokenBucket>;
  queue: QueueBucket;
  cacheHits: Map<string, number>;
  cacheMisses: Map<string, number>;
}

let currentWindow: AggregationWindow | null = null;
let flushTimer: NodeJS.Timeout | null = null;
let flushCallback: ((window: AggregationWindow) => Promise<void>) | null = null;

function getWindow(): AggregationWindow {
  if (!currentWindow) {
    currentWindow = {
      windowStart: Date.now(),
      latency: new Map(),
      tokens: new Map(),
      queue: { peakDepth: 0, peakAge: 0, reenqueueCount: 0, lockSkipCount: 0 },
      cacheHits: new Map(),
      cacheMisses: new Map(),
    };
  }
  return currentWindow;
}

function shouldSample(): boolean {
  return Math.random() < SAMPLE_RATE;
}

export function recordRouteLatency(
  routeClass: string,
  latencyMs: number,
  isError: boolean
): void {
  if (!ENABLED) return;
  if (!shouldSample()) return;

  const w = getWindow();
  let bucket = w.latency.get(routeClass);
  if (!bucket) {
    bucket = { count: 0, totalMs: 0, maxMs: 0, errorCount: 0 };
    w.latency.set(routeClass, bucket);
  }
  bucket.count++;
  bucket.totalMs += latencyMs;
  bucket.maxMs = Math.max(bucket.maxMs, latencyMs);
  if (isError) bucket.errorCount++;
}

export function recordTokenUsage(
  routeClass: string,
  promptTokens: number,
  completionTokens: number
): void {
  if (!ENABLED) return;

  const w = getWindow();
  let bucket = w.tokens.get(routeClass);
  if (!bucket) {
    bucket = { count: 0, promptTokens: 0, completionTokens: 0 };
    w.tokens.set(routeClass, bucket);
  }
  bucket.count++;
  bucket.promptTokens += promptTokens;
  bucket.completionTokens += completionTokens;
}

export function recordQueueSnapshot(
  depth: number,
  oldestAgeMs: number
): void {
  if (!ENABLED) return;

  const w = getWindow();
  w.queue.peakDepth = Math.max(w.queue.peakDepth, depth);
  w.queue.peakAge = Math.max(w.queue.peakAge, oldestAgeMs);
}

export function recordReenqueue(): void {
  if (!ENABLED) return;
  getWindow().queue.reenqueueCount++;
}

export function recordLockSkip(): void {
  if (!ENABLED) return;
  getWindow().queue.lockSkipCount++;
}

export function recordCacheHit(keyFamily: string): void {
  if (!ENABLED) return;
  const w = getWindow();
  w.cacheHits.set(keyFamily, (w.cacheHits.get(keyFamily) || 0) + 1);
}

export function recordCacheMiss(keyFamily: string): void {
  if (!ENABLED) return;
  const w = getWindow();
  w.cacheMisses.set(keyFamily, (w.cacheMisses.get(keyFamily) || 0) + 1);
}

/**
 * Register a flush callback that will be called with aggregated data.
 * The callback is responsible for persisting to the telemetry sink.
 */
export function registerFlushCallback(
  cb: (window: AggregationWindow) => Promise<void>
): void {
  flushCallback = cb;
}

/**
 * Flush the current aggregation window. Called periodically by the
 * flush timer, or manually for testing.
 */
export async function flushMetrics(): Promise<void> {
  if (!ENABLED || !currentWindow) return;

  const windowToFlush = currentWindow;
  currentWindow = null;

  if (!flushCallback) {
    console.log(
      `[metrics] Window ready (${windowToFlush.latency.size} route buckets, ` +
        `${windowToFlush.tokens.size} token buckets) but no flush callback registered`
    );
    return;
  }

  try {
    await flushCallback(windowToFlush);
  } catch (err) {
    console.error("[metrics] Flush error:", err);
  }
}

export function startMetricsFlush(): void {
  if (!ENABLED) return;
  if (flushTimer) return;

  flushTimer = setInterval(() => {
    flushMetrics().catch((err) =>
      console.error("[metrics] Periodic flush error:", err)
    );
  }, FLUSH_INTERVAL_MS);

  if (flushTimer.unref) flushTimer.unref();

  console.log(
    `[metrics] Started periodic flush (interval=${FLUSH_INTERVAL_MS}ms, sampleRate=${SAMPLE_RATE})`
  );
}

export function stopMetricsFlush(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

export type { AggregationWindow, LatencyBucket, TokenBucket, QueueBucket };
