"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUploadsStore, type UploadItem } from "@/state/uploads";
import { useUploadToSupabase } from "@/hooks/useUploadToSupabase";
import { assertOnline } from "@/lib/net/isOnline";

const retryDelay = (attempt: number) => {
  const schedule = [300, 1200, 3000];
  return schedule[Math.min(attempt - 1, schedule.length - 1)];
};

export function useUploadsList(threadId: string | null) {
  const { hydrate } = useUploadsStore();

  const q = useQuery<UploadItem[], Error>({
    queryKey: ["uploads", threadId ?? "root"],
    queryFn: async () => {
      const qs = threadId ? `?threadId=${encodeURIComponent(threadId)}` : "";
      const res = await fetch(`/api/uploads/list${qs}`);
      if (!res.ok) throw new Error(await res.text());
      const data: {
        items?: Array<{ name: string; size: number; path?: string }>;
      } = await res.json();
      const items: UploadItem[] = (data.items ?? []).map((it) => ({
        name: it.name,
        size: it.size,
        path: it.path,
        status: "done",
      }));
      return items;
    },
    staleTime: 60_000,
    retry: 3,
    retryDelay,
  });

  useEffect(() => {
    if (q.data) hydrate(threadId ?? null, q.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, threadId]);

  return q;
}

export function useUploadMutation(threadId: string | null) {
  const { add, setStatus, removeByName } = useUploadsStore();
  const { uploadFile } = useUploadToSupabase();
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["upload", threadId ?? "root"],
    mutationFn: async (file: File) => {
      assertOnline();
      add(threadId, { name: file.name, size: file.size, status: "queued" });
      setStatus(threadId, file.name, "uploading");
      const res = await uploadFile(file, { threadId });
      if (!res.ok) throw new Error(res.error || "Upload failed");
      return res;
    },
    retry: 3,
    retryDelay,
    onSuccess(res) {
      removeByName(threadId, res.file_name!);
      add(threadId, {
        name: res.file_name!,
        size: res.size_bytes!,
        path: res.storage_path!,
        status: "done",
      });
      qc.invalidateQueries({ queryKey: ["uploads", threadId ?? "root"] });
    },
    onError(err: unknown, file) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setStatus(threadId, file.name, "error", msg);
    },
  });
}

export function useDeleteUploadMutation(threadId: string | null) {
  const { list, hydrate } = useUploadsStore();
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["delete-upload", threadId ?? "root"],
    mutationFn: async ({ name, path }: { name: string; path: string }) => {
      assertOnline();
      const res = await fetch("/api/uploads/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error(await res.text());
      return { name, path };
    },
    retry: 3,
    retryDelay,
    onMutate: async (payload) => {
      const prev = list(threadId);
      hydrate(
        threadId,
        prev.filter((i) => i.name !== payload.name)
      );
      return { prev } as { prev: UploadItem[] };
    },
    onError: (_err, _payload, ctx) => {
      if (ctx && (ctx as { prev?: UploadItem[] }).prev)
        hydrate(threadId, (ctx as { prev: UploadItem[] }).prev);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uploads", threadId ?? "root"] });
    },
  });
}
