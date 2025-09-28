// src/server/uploads/logUpload.ts
"use server";

import { getServerClient } from "@/lib/supabaseServer";
import { BUCKET } from "@/lib/storage";

export type LogUploadInput = {
  storage_path: string;
  file_name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  thread_id?: string | null;
};

export async function logUpload(input: LogUploadInput) {
  const supa = getServerClient();
  const { data: userCtx } = await supa.auth.getUser();
  if (!userCtx.user) throw new Error("Unauthorized");

  // Ownership check by prefix to guard accidental misuse
  const requiredPrefix = `${BUCKET}/${userCtx.user.id}/`;
  if (!input.storage_path.startsWith(requiredPrefix)) {
    throw new Error("Forbidden");
  }

  const payload = {
    user_id: userCtx.user.id,
    thread_id: input.thread_id ?? null,
    bucket: BUCKET,
    storage_path: input.storage_path,
    file_name: input.file_name,
    mime_type: input.mime_type ?? null,
    size_bytes: input.size_bytes ?? null,
  };
  const { error } = await supa.from("uploads").insert(payload);
  if (error) throw error;
  return { ok: true } as const;
}
