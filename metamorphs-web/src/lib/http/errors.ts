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

export function jsonError(
  status: number,
  message: string,
  opts?: { retryAfterSec?: number }
) {
  const res = NextResponse.json({ error: message }, { status });
  if (opts?.retryAfterSec) {
    res.headers.set("Retry-After", String(opts.retryAfterSec));
  }
  return res;
}

/** Wrap a route handler to standardize unhandled error responses. */
export function withError<
  TReq extends Request | import("next/server").NextRequest,
  TRes extends Response
>(handler: (req: TReq) => Promise<TRes>): (req: TReq) => Promise<TRes> {
  return async (req: TReq) => {
    try {
      return await handler(req);
    } catch (e: any) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[route:error]", e);
      }
      const status = e?.statusCode || e?.status || 500;
      const msg =
        status >= 500
          ? "Internal Server Error"
          : e?.message || "Request failed";
      return jsonError(status, msg) as unknown as TRes;
    }
  };
}
