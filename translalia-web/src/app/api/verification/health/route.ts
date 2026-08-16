import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getMetricsSummary } from "@/lib/verification/monitoring";

/**
 * Health check and metrics endpoint for verification system
 * Internal use only - helps monitor system performance
 *
 * AUTH RESTORED (F-05-003 companion finding). The `requireUser` call here had
 * been commented out, leaving the endpoint open to anonymous callers. It is
 * not user data, but it does disclose operational posture — success rate, p95
 * latency, and which verification feature flags are enabled — which is exactly
 * the reconnaissance an attacker wants and which the file itself describes as
 * "internal use only".
 *
 * Requiring a session is safe for every known consumer: the only in-app caller
 * is the signed-in verification dashboard
 * (app/[locale]/(app)/verification-dashboard/page.tsx), whose fetch carries
 * cookies. External uptime probes should use `/api/health`, which is a bare
 * unauthenticated liveness check by design and exposes nothing.
 *
 * Not narrowed to admins only: there is no is_admin claim in this codebase to
 * check against, and inventing one here would be worse than a session gate.
 */
export async function GET() {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

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
