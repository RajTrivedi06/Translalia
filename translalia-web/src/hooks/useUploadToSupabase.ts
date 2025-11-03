"use client";

import { createBrowserClient } from "@/lib/supabaseBrowser";
import { buildPath, BUCKET, toBucketRelative } from "@/lib/storagePath";

export type UploadResult = {
  ok: boolean;
  error?: string;
  storage_path?: string;
  file_name?: string;
  size_bytes?: number;
  mime_type?: string;
};

const MAX_MB = 5;
const ALLOWED_EXT = [".txt", ".pdf"];

function isAllowed(file: File) {
  const lower = file.name.toLowerCase();
  return ALLOWED_EXT.some((ext) => lower.endsWith(ext));
}

export function useUploadToSupabase() {
  const supa = createBrowserClient();

  async function uploadFile(
    file: File,
    opts?: { threadId?: string | null }
  ): Promise<UploadResult> {
    if (!isAllowed(file))
      return { ok: false, error: "Only .txt and .pdf files are allowed." };
    if (file.size > MAX_MB * 1024 * 1024)
      return { ok: false, error: `File too large (> ${MAX_MB}MB).` };

    const { data: userCtx, error: userErr } = await supa.auth.getUser();
    if (userErr || !userCtx?.user) return { ok: false, error: "Unauthorized" };

    const objectId = crypto.randomUUID();
    const fullPath = buildPath({
      userId: userCtx.user.id,
      threadId: opts?.threadId ?? null,
      fileName: file.name,
      objectId,
    });

    const relPath = toBucketRelative(fullPath);
    const { error: upErr } = await supa.storage
      .from(BUCKET)
      .upload(relPath, file, {
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) return { ok: false, error: upErr.message };

    try {
      await fetch("/api/uploads/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storage_path: fullPath,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          thread_id: opts?.threadId ?? null,
        }),
      });
    } catch {}

    return {
      ok: true,
      storage_path: fullPath,
      file_name: file.name,
      size_bytes: file.size,
      mime_type: file.type || undefined,
    };
  }

  async function signPath(
    path: string
  ): Promise<{ url: string; expiresAt: string }> {
    const res = await fetch("/api/uploads/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ path, action: "sign" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "SIGN_FAILED");
    return { url: String(json.url), expiresAt: String(json.expiresAt) };
  }

  async function deletePath(path: string): Promise<{ ok: true }> {
    const res = await fetch("/api/uploads/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ path }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error || "DELETE_FAILED");
    }
    return { ok: true as const };
  }

  return { uploadFile, signPath, deletePath };
}
