import { NextResponse } from "next/server";
import { enforceConstraints } from "@/lib/constraints";

export async function POST(req: Request) {
  const { text, rules } = await req.json();
  return NextResponse.json(await enforceConstraints(text ?? "", rules ?? []));
}
