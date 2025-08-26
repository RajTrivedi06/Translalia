"use client";
import { useSearchParams } from "next/navigation";

export function useThreadId(): string | null {
  const sp = useSearchParams();
  const threadId = sp.get("thread");
  return threadId;
}
