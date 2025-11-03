import { NextResponse } from "next/server";
import { retrieveContext } from "@/lib/rag";

export async function POST(req: Request) {
  const { query } = await req.json();
  return NextResponse.json(await retrieveContext(query ?? ""));
}
