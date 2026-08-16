import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiGuard";

export const runtime = "nodejs";

const Q = z.object({
  projectId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /api/journey/list
 *
 * F-05-001: this route previously had no authentication of any kind. It built
 * a Supabase client from an optional Bearer header — falling back to the
 * cookie client when the header was absent — and then queried
 * journey_items_archive filtered only by the caller-supplied projectId. Any
 * request could name any project id. The only thing standing between that and
 * a full read of another tenant's journey history was an RLS policy that is
 * not in this repository and could not be verified.
 *
 * It now authenticates and checks project ownership before reading, matching
 * api/threads/list. The ownership check is defence in depth, not a substitute
 * for RLS: it fails closed here regardless of what the database policy does.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = Q.safeParse({
    projectId: url.searchParams.get("projectId"),
    limit: url.searchParams.get("limit") ?? "20",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { projectId, limit } = parsed.data;

  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
  const { user, sb } = guard;

  const { data: proj, error: projError } = await sb
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .single();

  if (projError || !proj) {
    return NextResponse.json(
      { ok: false, code: "PROJECT_NOT_FOUND" },
      { status: 404 }
    );
  }
  if (proj.owner_id !== user.id) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN_PROJECT" },
      { status: 403 }
    );
  }

  const { data, error } = await sb
    .from("journey_items_archive")
    .select("id, kind, summary, meta, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}
