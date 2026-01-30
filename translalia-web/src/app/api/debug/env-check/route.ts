import { NextResponse } from "next/server";

/**
 * Debug endpoint to check environment variable configuration.
 * Only available in preview/development environments.
 *
 * Usage: GET /api/debug/env-check
 */
export async function GET() {
  // Only allow in preview/development
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    // OpenAI
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    openAIKeyPrefix: process.env.OPENAI_API_KEY
      ? `${process.env.OPENAI_API_KEY.slice(0, 7)}...`
      : null,

    // Redis
    hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    redisUrlHost: process.env.UPSTASH_REDIS_REST_URL
      ? new URL(process.env.UPSTASH_REDIS_REST_URL).hostname
      : null,

    // Supabase
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseUrlHost: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null,

    // Lock configuration
    useRedisLock: process.env.USE_REDIS_LOCK,

    // Diagnostics
    enableDiagnostics: process.env.ENABLE_DIAGNOSTICS,
    debugSuggestions: process.env.DEBUG_SUGGESTIONS,
    debugLock: process.env.DEBUG_LOCK,
    debugVariants: process.env.DEBUG_VARIANTS,

    // Environment
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    vercelRegion: process.env.VERCEL_REGION,

    // Translation config
    suggestionsRateLimit: process.env.SUGGESTIONS_RATE_LIMIT,
    enableParallelStanzas: process.env.ENABLE_PARALLEL_STANZAS,
    chunkConcurrency: process.env.CHUNK_CONCURRENCY,
    maxStanzasPerTick: process.env.MAX_STANZAS_PER_TICK,
    mainGenParallelLines: process.env.MAIN_GEN_PARALLEL_LINES,
    mainGenLineConcurrency: process.env.MAIN_GEN_LINE_CONCURRENCY,
    enableTickTimeSlicing: process.env.ENABLE_TICK_TIME_SLICING,
  });
}
