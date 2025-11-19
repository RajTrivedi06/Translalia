import { NextResponse } from "next/server";
import { getMetricsSummary } from "@/lib/verification/monitoring";

/**
 * Health check and metrics endpoint for verification system
 * Internal use only - helps monitor system performance
 */
export async function GET() {
  try {
    // Optional: restrict to admin users only
    // const user = await requireUser();
    // if (!user.is_admin) return 403;

    const metrics = {
      last15min: getMetricsSummary(15),
      lastHour: getMetricsSummary(60),
      last24Hours: getMetricsSummary(1440),
    };

    const health: {
      status: string;
      timestamp: string;
      features: {
        trackA: boolean;
        trackB: boolean;
      };
      metrics: typeof metrics;
    } = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      features: {
        trackA:
          process.env.NEXT_PUBLIC_FEATURE_VERIFICATION_INTERNAL === "true",
        trackB: process.env.NEXT_PUBLIC_FEATURE_VERIFICATION_CONTEXT === "true",
      },
      metrics,
    };

    // Mark as unhealthy if success rate drops below 90%
    if (metrics.lastHour.successRate < 90) {
      health.status = "degraded";
    }

    // Mark as unhealthy if p95 latency exceeds 10 seconds
    if (metrics.lastHour.p95Duration > 10000) {
      health.status = "degraded";
    }

    return NextResponse.json(health);
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
