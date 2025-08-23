"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useInterviewFlow(threadId?: string) {
  const qc = useQueryClient();

  const peek = useQuery({
    enabled: !!threadId,
    queryKey: ["flow_peek", threadId],
    queryFn: async () => {
      const r = await fetch(`/api/flow/peek?threadId=${threadId}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error("peek failed");
      return (await r.json()) as {
        ok: boolean;
        phase: string;
        nextQuestion: { id: string; prompt: string } | null;
        snapshot: {
          poem_excerpt: string;
          collected_fields: Record<string, unknown>;
        };
      };
    },
  });

  const start = useMutation({
    mutationFn: async (poem: string) => {
      const r = await fetch(`/api/flow/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, poem }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "start failed");
      return j as {
        phase: string;
        nextQuestion: { id: string; prompt: string };
      };
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["flow_peek", threadId] }),
  });

  const answer = useMutation({
    mutationFn: async (payload: { questionId: string; answer: string }) => {
      const r = await fetch(`/api/flow/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, ...payload }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "answer failed");
      return j as {
        phase: string;
        nextQuestion?: { id: string; prompt: string } | null;
        planPreview?: {
          poem_excerpt: string;
          collected_fields: Record<string, unknown>;
          readyForEnhancer: boolean;
        };
      };
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["flow_peek", threadId] }),
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/flow/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "confirm failed");
      return j as { ok: boolean; phase: string };
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["flow_peek", threadId] }),
  });

  const enhancer = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/enhancer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "enhancer failed");
      return j as { ok: boolean; plan: unknown };
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["flow_peek", threadId] }),
  });

  const translate = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "translate failed");
      return j as {
        ok: boolean;
        result: { versionA: string; notes: string[]; blocked: boolean };
      };
    },
  });

  return { peek, start, answer, confirm, enhancer, translate };
}
