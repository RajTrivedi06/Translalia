// src/components/workspace/v2/_utils/persist.ts

export const LS_KEY = (threadId?: string | null) => `mm:v2:${threadId ?? "root"}`;

export function saveLocal(threadId: string | null | undefined, data: unknown) {
  try {
    localStorage.setItem(LS_KEY(threadId), JSON.stringify(data));
  } catch {
    // Silently fail if localStorage is not available or quota exceeded
  }
}

export function loadLocal<T>(threadId: string | null | undefined): T | null {
  try {
    const raw = localStorage.getItem(LS_KEY(threadId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}