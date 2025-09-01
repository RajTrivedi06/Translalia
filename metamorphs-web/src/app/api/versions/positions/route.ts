import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiGuard";

const schema = z.object({
  projectId: z.string().uuid(),
  positions: z
    .array(
      z.object({
        id: z.string().uuid(),
        pos: z.object({ x: z.number(), y: z.number() }),
      })
    )
    .min(1),
});

export async function PATCH(req: NextRequest) {
  const guard = await requireUser(req);
  if ("res" in guard) return guard.res;
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const sb = guard.sb;

  // Upsert only id + pos; RLS must allow editing member
  const updates = body.data.positions.map((p) => ({ id: p.id, pos: p.pos }));
  const { error } = await sb
    .from("versions")
    .upsert(updates, { onConflict: "id" });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 200 });
}
