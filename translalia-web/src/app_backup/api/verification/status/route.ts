import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getServerClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json(
        { error: { code: "MISSING_PARAM", message: "threadId required" } },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    const { data: thread, error } = await supabase
      .from("chat_threads")
      .select("state, created_by")
      .eq("id", threadId)
      .single();

    if (error || thread.created_by !== user.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authorized" } },
        { status: 403 }
      );
    }

    const workshopLines = (thread.state as any)?.workshop_lines || [];

    const lines = workshopLines.map((line: any, index: number) => ({
      lineIndex: index,
      graded: line.verification?.trackA?.graded || false,
      overall: line.verification?.trackA?.summary?.overall,
      dimensions: line.verification?.trackA?.summary?.dimensions,
    }));

    const gradedLines = lines.filter((l: any) => l.graded);
    const avgScore =
      gradedLines.length > 0
        ? gradedLines.reduce(
            (sum: number, l: any) => sum + (l.overall || 0),
            0
          ) / gradedLines.length
        : 0;

    return NextResponse.json({
      lines,
      stats: {
        total: lines.length,
        graded: gradedLines.length,
        avgScore: Math.round(avgScore * 10) / 10,
      },
    });
  } catch (error) {
    console.error("[verification/status] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch status" } },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
