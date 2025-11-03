"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * Lazy-loaded components for better initial load performance
 *
 * Heavy components are loaded on-demand to improve:
 * - Initial page load time
 * - Bundle size
 * - Time to interactive
 * - Lighthouse performance score
 */

// Loading fallback component
function LoadingFallback({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

/**
 * Lazy-loaded ComparisonView
 * Only loads when user clicks "Compare" button
 */
export const LazyComparisonView = dynamic(
  () =>
    import("./ComparisonView").then((mod) => ({
      default: mod.ComparisonView,
    })),
  {
    loading: () => <LoadingFallback message="Loading comparison view..." />,
    ssr: false, // Client-side only
  }
);

/**
 * Lazy-loaded JourneySummary
 * Only loads when user clicks "Journey" button
 */
export const LazyJourneySummary = dynamic(
  () =>
    import("./JourneySummary").then((mod) => ({
      default: mod.JourneySummary,
    })),
  {
    loading: () => <LoadingFallback message="Loading journey summary..." />,
    ssr: false,
  }
);

/**
 * Lazy-loaded PoemAssembly
 * Only loads when user toggles to assembly view
 */
export const LazyPoemAssembly = dynamic(
  () =>
    import("./PoemAssembly").then((mod) => ({
      default: mod.PoemAssembly,
    })),
  {
    loading: () => <LoadingFallback message="Loading poem assembly..." />,
    ssr: false,
  }
);

/**
 * Lazy-loaded CompletionCelebration
 * Only loads when poem is 100% complete
 */
export const LazyCompletionCelebration = dynamic(
  () =>
    import("./CompletionCelebration").then((mod) => ({
      default: mod.CompletionCelebration,
    })),
  {
    loading: () => null, // No loading state needed (shows after completion)
    ssr: false,
  }
);

/**
 * Preload a lazy component
 * Call this to prefetch before user needs it
 */
export const preloadComponents = {
  comparison: () => import("./ComparisonView"),
  journey: () => import("./JourneySummary"),
  assembly: () => import("./PoemAssembly"),
  celebration: () => import("./CompletionCelebration"),
};
