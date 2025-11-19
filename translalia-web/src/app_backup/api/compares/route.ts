import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";
import { createCompareSchema } from "@/lib/schemas";

/**
 * POST /api/compares
 * Body: { projectId: string; leftId: string; rightId: string; lens?: string; granularity?: string; notes?: string }
 */
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
  const parsed = createCompareSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { projectId, leftId, rightId } = parsed.data;
  const lens = parsed.data.lens ?? "meaning";
  const granularity = parsed.data.granularity ?? "line";
  const notes = parsed.data.notes;

  if (leftId === rightId) {
    return NextResponse.json(
      { error: "leftId and rightId must be different" },
      { status: 400 }
    );
  }

  const { data: c, error } = await guard.sb
    .from("compares")
    .insert({
      project_id: projectId,
      left_version_id: leftId,
      right_version_id: rightId,
      lens,
      granularity,
      notes: notes ?? null,
    })
    .select(
      "id, project_id, left_version_id, right_version_id, lens, granularity, created_at"
    )
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  await guard.sb.from("journey_items").insert({
    project_id: projectId,
    kind: "compare",
    summary: `Compared ${leftId} vs ${rightId} (${lens}/${granularity})`,
    compare_id: c.id,
  });

  return NextResponse.json({ compare: c }, { status: 201 });
}
