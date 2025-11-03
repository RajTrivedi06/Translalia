// src/lib/threadStorage.ts
// Thread-aware storage wrapper for Zustand persist.
// It rewrites the key to include the active threadId.

let activeThreadId: string | null = null;

export function setActiveThreadId(id: string | null) {
  activeThreadId = id ?? null;
  // keep a breadcrumb (useful for debugging)
  try {
    if (id) localStorage.setItem("last-thread-id", id);
  } catch {}
}

export function getActiveThreadId(): string | null {
  if (activeThreadId) return activeThreadId;
  // Fallback: parse from location (client only)
  if (typeof window !== "undefined") {
    const m = window.location.pathname.match(/\/threads\/([^/]+)/);
    if (m?.[1]) return m[1];
    try {
      return localStorage.getItem("last-thread-id");
    } catch {}
  }
  return null;
}

// Zustand StateStorage that namespaces keys by threadId.
export const threadStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    const tid = getActiveThreadId();
    const key = tid ? `${name}:${tid}` : `${name}:__global__`;
    return window.localStorage.getItem(key);
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    const tid = getActiveThreadId();
    const key = tid ? `${name}:${tid}` : `${name}:__global__`;
    window.localStorage.setItem(key, value);
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    const tid = getActiveThreadId();
    const key = tid ? `${name}:${tid}` : `${name}:__global__`;
    window.localStorage.removeItem(key);
  },
};
