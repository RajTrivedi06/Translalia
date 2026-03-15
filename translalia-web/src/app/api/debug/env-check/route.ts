import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";

/**
 * Debug endpoint to check environment variable configuration.
 * Only available in preview/development environments.
 *
 * Usage: GET /api/debug/env-check
 */
export async function GET() {
  const explicitlyEnabled = process.env.DEBUG_API_ENABLED === "1";
  const productionLike =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";
  if (productionLike && !explicitlyEnabled) {
    return NextResponse.json(
      { error: "Not available" },
      { status: 404 },
    );
  }

  const { user, response } = await requireUser();
  if (!user) return response;

  return NextResponse.json({
    // OpenAI
    hasOpenAI: !!process.env.OPENAI_API_KEY,

    // Redis
    hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,

    // Supabase
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,

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
