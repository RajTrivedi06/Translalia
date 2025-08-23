import crypto from "crypto";

const mem = new Map<string, { expires: number; value: unknown }>();

export function stableHash(obj: unknown): string {
  const json = JSON.stringify(
    obj,
    Object.keys(obj as Record<string, unknown>).sort()
  );
  return crypto.createHash("sha256").update(json).digest("hex");
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const item = mem.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    mem.delete(key);
    return null;
  }
  return item.value as T;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSec = 3600
): Promise<void> {
  mem.set(key, { expires: Date.now() + ttlSec * 1000, value });
}
