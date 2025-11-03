// src/lib/http/timing.ts
export async function withTiming(name: string, fn: () => Promise<Response>) {
  const t0 = performance.now();
  const res = await fn();
  const t1 = performance.now();
  const dur = (t1 - t0).toFixed(1);
  const existing = res.headers.get("Server-Timing");
  const value = existing
    ? `${existing}, ${name};dur=${dur}`
    : `${name};dur=${dur}`;
  const newHeaders = new Headers(res.headers);
  newHeaders.set("Server-Timing", value);
  return new Response(res.body, { status: res.status, headers: newHeaders });
}
