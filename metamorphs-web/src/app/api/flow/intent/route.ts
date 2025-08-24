import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyIntentLLM } from "@/server/flow/intentLLM";

const Body = z.object({ message: z.string().min(1), phase: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { message, phase } = parsed.data;
  const result = await classifyIntentLLM(message, phase);
  return NextResponse.json({ intent: result?.intent ?? null });
}
