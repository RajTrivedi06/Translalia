import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  beforeCreatedAt: z.string().datetime().optional(),
  beforeId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  try {
    // 1) Authenticate user
    const guard = await requireUser(req);
    if ("res" in guard) return guard.res;
    const { sb } = guard;

    // 2) Parse and validate query parameters
    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      limit: url.searchParams.get("limit") ?? "20",
      beforeCreatedAt: url.searchParams.get("beforeCreatedAt") ?? undefined,
      beforeId: url.searchParams.get("beforeId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { limit, beforeCreatedAt, beforeId } = parsed.data;

    // 3) Call RPC function
    const { data, error } = await sb.rpc("diary_completed_poems", {
      p_limit: limit,
      p_before_created_at: beforeCreatedAt || null,
      p_before_id: beforeId || null,
    });

    if (error) {
      console.error("[diary/completed-poems] RPC error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const items = (data || []) as Array<{
      thread_id: string;
      title: string;
      thread_created_at: string;
      raw_poem: string | null;
      workshop_lines: unknown;
      notebook_notes: unknown;
      journey_summary_created_at: string | null;
      reflection_text: string | null;
      insights: string[] | null;
      strengths: string[] | null;
      challenges: string[] | null;
      recommendations: string[] | null;
    }>;

    // 4) Derive next cursor if we got a full page
    let nextCursor: { beforeCreatedAt: string; beforeId: string } | undefined;
    if (items.length === limit && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = {
        beforeCreatedAt: lastItem.thread_created_at,
        beforeId: lastItem.thread_id,
      };
    }

    return NextResponse.json({
      ok: true,
      items,
      ...(nextCursor && { nextCursor }),
    });
  } catch (e: unknown) {
    const message = (e as { message?: string })?.message || "Internal error";
    console.error("[diary/completed-poems] fatal error:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
