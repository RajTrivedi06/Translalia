import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { text } = await req.json();
  // Echo stub – replace with real chain later
  return NextResponse.json({ ok: true, echo: text ?? "" });
}
