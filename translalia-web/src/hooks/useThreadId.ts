"use client";
import { useParams } from "next/navigation";

export function useThreadId(): string | null {
  const params = useParams();
  // Extract threadId from URL path: /workspaces/[projectId]/threads/[threadId]
  const threadId = params?.threadId as string | undefined;
  return threadId || null;
}
