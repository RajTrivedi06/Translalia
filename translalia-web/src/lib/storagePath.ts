// Client-safe storage path helpers (no server actions here)

export const BUCKET =
  process.env.NEXT_PUBLIC_STORAGE_BUCKETS_CORPORA || "corpora";

export type BuildPathInput = {
  userId: string;
  threadId?: string | null;
  fileName: string;
  objectId: string; // caller supplies crypto.randomUUID()
};

export function buildPath({
  userId,
  threadId,
  fileName,
  objectId,
}: BuildPathInput) {
  const safeName = fileName.replace(/[^\w.\-]+/g, "_");
  const folder = threadId?.trim() ? threadId : "root";
  return `${BUCKET}/${userId}/${folder}/${objectId}-${safeName}`;
}

export function toBucketRelative(fullPath: string) {
  if (!fullPath.startsWith(`${BUCKET}/`)) {
    throw new Error(`Path must start with '${BUCKET}/'`);
  }
  return fullPath.slice(BUCKET.length + 1);
}
