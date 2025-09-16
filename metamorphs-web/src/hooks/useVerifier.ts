import { useMutation } from "@tanstack/react-query";

export function useVerifyTranslation() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      threadId: string;
      source: string;
      candidate: string;
    }) => {
      const res = await fetch("/api/translator/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        data: { scores: Record<string, number>; advice: string };
        prompt_hash: string;
      }>;
    },
  });
}

export function useBackTranslate() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      threadId: string;
      candidate: string;
    }) => {
      const res = await fetch("/api/translator/backtranslate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        data: {
          back_translation: string;
          drift: "none" | "minor" | "major";
          notes: string;
        };
        prompt_hash: string;
      }>;
    },
  });
}
