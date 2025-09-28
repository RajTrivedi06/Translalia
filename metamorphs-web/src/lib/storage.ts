// src/lib/storage.ts
"use server";

import { createAdminClient } from "./supabaseAdmin";

export const BUCKET = process.env.STORAGE_BUCKETS_CORPORA ?? "corpora";

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

export async function getSignedUrl(path: string, expiresInSec = 300) {
  const admin = createAdminClient();
  const relativePath = toBucketRelative(path);
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(relativePath, expiresInSec);
  if (error) throw error;
  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
  };
}

export async function removeObject(path: string) {
  const admin = createAdminClient();
  const relativePath = toBucketRelative(path);
  const { error } = await admin.storage.from(BUCKET).remove([relativePath]);
  if (error) throw error;
}
