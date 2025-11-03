"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Network resilience hook for API calls
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Offline detection
 * - Request cancellation on unmount
 * - Timeout handling
 * - Error recovery
 *
 * @example
 * ```tsx
 * const { execute, isLoading, error } = useNetworkResilience({
 *   maxRetries: 3,
 *   retryDelay: 1000,
 *   timeout: 30000,
 * });
 *
 * const handleSubmit = async () => {
 *   const result = await execute(async () => {
 *     const res = await fetch('/api/endpoint');
 *     return res.json();
 *   });
 * };
 * ```
 */

export interface NetworkResilienceOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial retry delay in ms (doubled each retry) */
  retryDelay?: number;
  /** Request timeout in ms */
  timeout?: number;
  /** Callback when offline */
  onOffline?: () => void;
  /** Callback when back online */
  onOnline?: () => void;
}

export function useNetworkResilience(options: NetworkResilienceOptions = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    timeout = 30000,
    onOffline,
    onOnline,
  } = options;

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      onOnline?.();
    };

    const handleOffline = () => {
      setIsOnline(false);
      onOffline?.();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [onOffline, onOnline]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Execute a function with retry logic
   */
  const execute = useCallback(
    async <T,>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
      // Check if online
      if (!isOnline) {
        const error = new Error(
          "You're offline. Please check your internet connection."
        );
        setError(error);
        throw error;
      }

      setIsLoading(true);
      setError(null);

      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      let lastError: Error | null = null;
      let currentDelay = retryDelay;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let timeoutId: NodeJS.Timeout | null = null;
        try {
          // Set timeout
          timeoutId = setTimeout(() => {
            abortController.abort();
          }, timeout);

          // Execute the function
          const result = await fn(abortController.signal);

          // Success! Clear timeout and return
          if (timeoutId) clearTimeout(timeoutId);
          setIsLoading(false);
          setError(null);
          return result;
        } catch (err) {
          if (timeoutId) clearTimeout(timeoutId);
          lastError = err instanceof Error ? err : new Error(String(err));

          // If aborted, don't retry
          if (abortController.signal.aborted) {
            setIsLoading(false);
            setError(new Error("Request cancelled"));
            throw new Error("Request cancelled");
          }

          // If not the last attempt, wait and retry
          if (attempt < maxRetries) {
            console.log(
              `[NetworkResilience] Retry ${
                attempt + 1
              }/${maxRetries} in ${currentDelay}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, currentDelay));
            currentDelay *= 2; // Exponential backoff
          }
        }
      }

      // All retries failed
      setIsLoading(false);
      setError(lastError);
      throw lastError;
    },
    [isOnline, maxRetries, retryDelay, timeout]
  );

  /**
   * Cancel the current request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  /**
   * Reset error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    execute,
    cancel,
    clearError,
    isLoading,
    error,
    isOnline,
  };
}

/**
 * Hook for showing network status indicator
 */
export function useNetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineWarning(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineWarning(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOnline,
    showOfflineWarning,
    dismissWarning: () => setShowOfflineWarning(false),
  };
}

/**
 * NetworkStatusBanner - Shows warning when offline
 */
export function NetworkStatusBanner() {
  const { isOnline, showOfflineWarning, dismissWarning } =
    useNetworkStatusIndicator();

  if (!showOfflineWarning) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">
            You're offline. Changes will be saved locally and synced when you
            reconnect.
          </span>
        </div>
        <button
          onClick={dismissWarning}
          className="text-white hover:text-amber-100 transition"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
