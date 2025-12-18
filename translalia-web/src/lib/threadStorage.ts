// src/lib/threadStorage.ts
// Thread-aware storage wrapper for Zustand persist.
// It rewrites the key to include the active threadId.

let activeThreadId: string | null = null;
let isInitialized = false;

/**
 * Get the active thread ID with comprehensive SSR/hydration safety.
 * Returns null during SSR or before hydration to prevent crashes.
 */
export function getActiveThreadId(): string | null {
  // Layer 1: Check if we're in a browser environment
  if (typeof window === "undefined") {
    // We're on the server - can't access browser APIs
    return null;
  }

  // Layer 2: Check if document is still loading
  if (typeof document !== "undefined" && document.readyState === "loading") {
    // Document still loading - wait until it's ready
    return null;
  }

  // Layer 3: Check if window.location exists and is accessible
  try {
    if (!window.location || !window.location.pathname) {
      return null;
    }
  } catch (e) {
    // In some edge cases, accessing window.location can throw
    console.warn("[threadStorage] Cannot access window.location:", e);
    return null;
  }

  // NOW it's safe to access browser APIs

  // Return cached value if we trust it matches current URL
  if (activeThreadId) {
    // Verify cached value matches current URL
    try {
      const urlMatch = window.location.pathname.match(/\/threads\/([^/]+)/);
      const urlThreadId = urlMatch?.[1] || null;

      // If URL has a thread ID and it matches cache, return cache
      if (urlThreadId && urlThreadId === activeThreadId) {
        return activeThreadId;
      }

      // If URL has different thread ID, update cache
      if (urlThreadId && urlThreadId !== activeThreadId) {
        activeThreadId = urlThreadId;
        try {
          localStorage.setItem("last-thread-id", urlThreadId);
        } catch {}
        return urlThreadId;
      }

      // If URL has no thread ID but we have cache, return cache
      if (!urlThreadId && activeThreadId) {
        return activeThreadId;
      }
    } catch (e) {
      console.warn("[threadStorage] Error checking URL:", e);
      return activeThreadId; // Return cache as fallback
    }
  }

  // No cached value - try to get from URL
  try {
    const match = window.location.pathname.match(/\/threads\/([^/]+)/);
    if (match?.[1]) {
      const threadIdFromUrl = match[1];
      activeThreadId = threadIdFromUrl;

      // Persist to localStorage
      try {
        localStorage.setItem("last-thread-id", threadIdFromUrl);
      } catch (storageError) {
        // localStorage might be unavailable (private mode, etc.)
        console.warn(
          "[threadStorage] Cannot access localStorage:",
          storageError
        );
      }

      return threadIdFromUrl;
    }
  } catch (e) {
    console.warn("[threadStorage] Error parsing URL:", e);
  }

  // Final fallback: Try localStorage
  try {
    const lastThreadId = localStorage.getItem("last-thread-id");
    if (lastThreadId) {
      return lastThreadId;
    }
  } catch (e) {
    console.warn("[threadStorage] Cannot read from localStorage:", e);
  }

  return null;
}

/**
 * Initialize thread ID explicitly (should be called from component after mount).
 */
export function initializeThreadId(threadId: string | null) {
  activeThreadId = threadId;
  isInitialized = true;

  if (threadId && typeof window !== "undefined") {
    try {
      localStorage.setItem("last-thread-id", threadId);
    } catch (e) {
      console.warn("[threadStorage] Cannot write to localStorage:", e);
    }
  }
}

/**
 * Clear active thread ID (call on unmount).
 */
export function clearActiveThreadId() {
  activeThreadId = null;
  isInitialized = false;
}

/**
 * Set active thread ID synchronously (call before store access).
 */
export function setActiveThreadId(threadId: string | null) {
  activeThreadId = threadId;
  isInitialized = true;
}

/**
 * Export flag for components to check
 */
export function isThreadIdInitialized(): boolean {
  return isInitialized;
}

// Zustand StateStorage that namespaces keys by threadId.
export const threadStorage = {
  getItem: (name: string): string | null => {
    // SSR safety
    if (typeof window === "undefined") return null;

    try {
      const tid = getActiveThreadId();
      const key = tid ? `${name}:${tid}` : `${name}:__global__`;
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn(`[threadStorage] Error reading ${name}:`, e);
      return null;
    }
  },

  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;

    try {
      const tid = getActiveThreadId();
      const key = tid ? `${name}:${tid}` : `${name}:__global__`;
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[threadStorage] Error writing ${name}:`, e);
    }
  },

  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;

    try {
      const tid = getActiveThreadId();
      const key = tid ? `${name}:${tid}` : `${name}:__global__`;
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[threadStorage] Error removing ${name}:`, e);
    }
  },
};
