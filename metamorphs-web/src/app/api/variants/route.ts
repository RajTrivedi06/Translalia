import { NextResponse } from "next/server";
import { generateVariants } from "@/lib/generation";

export async function POST(req: Request) {
  const { input, recipe } = await req.json();
  return NextResponse.json(
    await generateVariants(input ?? "", recipe ?? "prismatic")
  );
}
