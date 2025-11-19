import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { getServerClient } from "@/lib/supabaseServer";

const analyticsRequestSchema = z.object({
  projectId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

interface DimensionStats {
  semantic_accuracy: number;
  cultural_fidelity: number;
  rhythm_prosody: number;
  register_tone: number;
  dialect_preservation: number;
  option_quality: number;
}

interface LowScoreLine {
  lineIndex: number;
  threadId: string;
  projectId: string;
  score: number;
  issues: string[];
  sourceLine?: string;
  translatedLine?: string;
  gradedAt: string;
  auditId?: string;
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  console.log("[verification/analytics]", requestId, "Fetching analytics");

  try {
    // 1. Authenticate user
    const { user, response } = await requireUser();
    if (!user) return response;

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = analyticsRequestSchema.parse({
      projectId: searchParams.get("projectId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      limit: parseInt(searchParams.get("limit") || "100"),
    });

    // 3. Get Supabase client
    const supabase = await getServerClient();

    // 4. Build query for prompt_audits
    let query = supabase
      .from("prompt_audits")
      .select("id, params, created_at, thread_id, project_id")
      .eq("stage", "line-verification-internal")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(params.limit);

    // Filter by project if specified
    if (params.projectId) {
      query = query.eq("project_id", params.projectId);
    }

    // Filter by date range if specified
    if (params.startDate) {
      query = query.gte("created_at", params.startDate);
    }
    if (params.endDate) {
      query = query.lte("created_at", params.endDate);
    }

    const { data: grades, error } = await query;

    if (error) {
      console.error(
        "[verification/analytics]",
        requestId,
        "Query error:",
        error
      );
      return NextResponse.json(
        { error: { code: "QUERY_ERROR", message: "Failed to fetch grades" } },
        { status: 500 }
      );
    }

    console.log(
      "[verification/analytics]",
      requestId,
      `Found ${grades?.length || 0} audit records`
    );

    // 5. Filter to only audits with grade data
    const gradesWithData =
      grades?.filter((audit: any) => (audit.params as any)?.grade) || [];

    // 6. Calculate aggregate statistics
    const totalGraded = gradesWithData.length;

    if (totalGraded === 0) {
      return NextResponse.json({
        totalGraded: 0,
        averageScores: null,
        scoreDistribution: null,
        lowScoreLines: [],
        recentGrades: [],
      });
    }

    // Calculate average scores across all dimensions
    const dimensionSums: DimensionStats = {
      semantic_accuracy: 0,
      cultural_fidelity: 0,
      rhythm_prosody: 0,
      register_tone: 0,
      dialect_preservation: 0,
      option_quality: 0,
    };

    let overallSum = 0;
    const scoreDistribution: Record<number, number> = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
    };

    gradesWithData.forEach((audit: any) => {
      // Grade data is stored in params.grade
      const gradeData = (audit.params as any)?.grade;
      const overallScore = gradeData.overall_score || 0;
      const scores = gradeData.scores || {};

      overallSum += overallScore;

      // Track distribution
      const bucket = Math.floor(overallScore);
      if (bucket >= 0 && bucket <= 10) {
        scoreDistribution[bucket] = (scoreDistribution[bucket] || 0) + 1;
      }

      // Sum dimension scores
      Object.keys(dimensionSums).forEach((dim) => {
        dimensionSums[dim as keyof DimensionStats] += scores[dim] || 0;
      });
    });

    const averageScores: DimensionStats & { overall: number } = {
      overall: Math.round((overallSum / totalGraded) * 10) / 10,
      semantic_accuracy:
        Math.round((dimensionSums.semantic_accuracy / totalGraded) * 10) / 10,
      cultural_fidelity:
        Math.round((dimensionSums.cultural_fidelity / totalGraded) * 10) / 10,
      rhythm_prosody:
        Math.round((dimensionSums.rhythm_prosody / totalGraded) * 10) / 10,
      register_tone:
        Math.round((dimensionSums.register_tone / totalGraded) * 10) / 10,
      dialect_preservation:
        Math.round((dimensionSums.dialect_preservation / totalGraded) * 10) /
        10,
      option_quality:
        Math.round((dimensionSums.option_quality / totalGraded) * 10) / 10,
    };

    // 7. Identify low-scoring lines (below 6)
    const lowScoreLines: LowScoreLine[] = gradesWithData
      .filter((audit: any) => {
        const gradeData = (audit.params as any)?.grade;
        return (gradeData.overall_score || 0) < 6;
      })
      .map((audit: any) => {
        const gradeData = (audit.params as any)?.grade;
        return {
          lineIndex: (audit.params as any)?.lineIndex || 0,
          threadId: audit.thread_id || "",
          projectId: audit.project_id || "",
          score: gradeData.overall_score || 0,
          issues: gradeData.issues || [],
          gradedAt: audit.created_at,
          auditId: audit.id,
        };
      })
      .slice(0, 20); // Limit to 20 most recent problematic lines

    // 8. Recent grades for timeline
    const recentGrades = gradesWithData.slice(0, 10).map((audit: any) => {
      const gradeData = (audit.params as any)?.grade;
      return {
        score: gradeData.overall_score || 0,
        timestamp: audit.created_at,
        lineIndex: (audit.params as any)?.lineIndex,
        threadId: audit.thread_id,
      };
    });

    console.log(
      "[verification/analytics]",
      requestId,
      "Analytics computed successfully"
    );

    // 8. Return aggregated stats
    return NextResponse.json({
      totalGraded,
      averageScores,
      scoreDistribution,
      lowScoreLines,
      recentGrades,
      dateRange: {
        start:
          params.startDate ||
          gradesWithData[gradesWithData.length - 1]?.created_at ||
          new Date().toISOString(),
        end:
          params.endDate ||
          gradesWithData[0]?.created_at ||
          new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[verification/analytics]", requestId, "Error:", err);

    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: { code: "VALIDATION_ERROR", message: err.message },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Analytics failed" } },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
