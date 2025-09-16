import { NextResponse } from "next/server";

/** Convert LLM client errors to concise HTTP responses, preserving Retry-After on 429. */
export function respondLLMError(e: any) {
  const status = e?.status ?? e?.response?.status ?? 502;
  const retryAfter = e?.response?.headers?.get?.("retry-after");
  const body = { error: e?.message ?? "LLM error" } as const;
  const res = NextResponse.json(body, { status });
  if (retryAfter) res.headers.set("Retry-After", String(retryAfter));
  return res;
}
