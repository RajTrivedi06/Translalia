import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiGuard";
import { createVersionSchema } from "@/lib/schemas";

/**
 * POST /api/versions
 * Body: {
 *   projectId: string;
 *   title: string;
 *   lines: string[];
 *   tags?: string[];
 *   meta?: Record<string, unknown>;
 *   summary?: string; // optional journey text
 * }
 */
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (guard.res) return guard.res;
  const parsed = createVersionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: v, error: vErr } = await guard.sb
    .from("versions")
    .insert({
      project_id: parsed.data.projectId,
      title: parsed.data.title,
      lines: parsed.data.lines,
      tags: parsed.data.tags ?? [],
      meta: parsed.data.meta ?? {},
    })
    .select("id, project_id, title, lines, tags, meta, created_at")
    .single();

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 400 });

  const summary =
    parsed.data.summary ??
    `Created ${v.title || "a version"} (${new Date().toLocaleTimeString()})`;
  await guard.sb.from("journey_items").insert({
    project_id: v.project_id,
    kind: "draft",
    summary,
    to_version_id: v.id,
  });

  return NextResponse.json({ version: v }, { status: 201 });
}
