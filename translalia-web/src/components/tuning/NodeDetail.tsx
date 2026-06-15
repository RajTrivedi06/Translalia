"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { promptHistory, type PipelineNode } from "./mockData";
import { HistoryView } from "./HistoryView";
import { TranslationInstructions } from "./sections/TranslationInstructions";
import { ModelSettings } from "./sections/ModelSettings";
import { OutputRequirements } from "./sections/OutputRequirements";
import { TestRun } from "./sections/TestRun";
import { ReasoningTrace } from "./sections/ReasoningTrace";
import {
  pillToggle,
  pillToggleActive,
  pillToggleContainer,
  pillToggleInactive,
} from "./uiClasses";
import { useReducedMotion } from "./useReducedMotion";

interface NodeDetailProps {
  /** Selected node, or null to collapse the panel. */
  node: PipelineNode | null;
  onClose: () => void;
}

type Tab = "current" | "history";

/**
 * Inline-expanding detail panel for the selected pipeline node.
 *
 * Open: the container animates `grid-template-rows` 0fr→1fr (smooth, no
 * measuring, never clips tall content), then the content fades in once the
 * container has mostly expanded (two-phase). Close: the content fades out
 * first, then the row collapses, then the panel unmounts. Switching nodes
 * cross-fades the content (the row re-sizes while hidden, so height never
 * jumps). State is kept in `displayNode` so content survives the collapse.
 */
export function NodeDetail({ node, onClose }: NodeDetailProps) {
  const reducedMotion = useReducedMotion();
  const [displayNode, setDisplayNode] = React.useState<PipelineNode | null>(
    node,
  );
  const [gridOpen, setGridOpen] = React.useState(false);
  const [contentShown, setContentShown] = React.useState(false);
  // `activeTab` drives the pill highlight (responds instantly); `shownTab`
  // drives the rendered body and only swaps once the old view has faded out.
  const [activeTab, setActiveTab] = React.useState<Tab>("current");
  const [shownTab, setShownTab] = React.useState<Tab>("current");
  const [tabFading, setTabFading] = React.useState(false);
  // Which node id is currently rendered — lets us tell opening from switching
  // (cross-fade between nodes) from closing.
  const displayedIdRef = React.useRef<string | null>(node?.id ?? null);

  const switchTab = React.useCallback((next: Tab) => {
    setActiveTab((current) => {
      if (current === next) return current;
      setTabFading(true);
      window.setTimeout(() => {
        setShownTab(next);
        setTabFading(false);
      }, 200);
      return next;
    });
  }, []);

  const handleTabsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      switchTab(activeTab === "current" ? "history" : "current");
    }
  };

  React.useEffect(() => {
    if (node) {
      const switching =
        displayedIdRef.current !== null && displayedIdRef.current !== node.id;

      // Reduced motion: no choreography — show the panel + content at once.
      if (reducedMotion) {
        setDisplayNode(node);
        setActiveTab("current");
        setShownTab("current");
        setTabFading(false);
        displayedIdRef.current = node.id;
        setGridOpen(true);
        setContentShown(true);
        return;
      }

      if (switching) {
        // Switching nodes: cross-fade. The grid row re-sizes to the new
        // content while it's hidden, so the height never visibly jumps.
        setContentShown(false);
        const swap = window.setTimeout(() => {
          setDisplayNode(node);
          setActiveTab("current");
          setShownTab("current");
          setTabFading(false);
          displayedIdRef.current = node.id;
          setContentShown(true);
        }, 200);
        return () => window.clearTimeout(swap);
      }

      // Opening from closed: expand the row, then fade content in after it.
      setDisplayNode(node);
      setActiveTab("current");
      setShownTab("current");
      setTabFading(false);
      setContentShown(false);
      displayedIdRef.current = node.id;
      const raf = requestAnimationFrame(() => setGridOpen(true));
      const fadeIn = window.setTimeout(() => setContentShown(true), 150);
      return () => {
        cancelAnimationFrame(raf);
        window.clearTimeout(fadeIn);
      };
    }

    // Closing (reduced motion): collapse + unmount immediately.
    if (reducedMotion) {
      setContentShown(false);
      setGridOpen(false);
      setDisplayNode(null);
      displayedIdRef.current = null;
      return;
    }

    // Closing: fade content out, then collapse the row, then unmount.
    setContentShown(false);
    const collapse = window.setTimeout(() => setGridOpen(false), 200);
    const unmount = window.setTimeout(() => {
      setDisplayNode(null);
      displayedIdRef.current = null;
    }, 500);
    return () => {
      window.clearTimeout(collapse);
      window.clearTimeout(unmount);
    };
  }, [node, reducedMotion]);

  // Escape closes the panel (deselects the node).
  React.useEffect(() => {
    if (!node) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [node, onClose]);

  if (!displayNode) return null;

  const isPrompt = displayNode.id === "prompt";

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-smooth motion-reduce:transition-none",
        gridOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            "border-t border-border-subtle pb-12 pt-8 transition-opacity duration-200 ease-out motion-reduce:transition-none",
            contentShown ? "opacity-100" : "opacity-0",
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">
                {displayNode.name}
              </h2>
              <p className="mt-1 text-sm text-foreground-secondary">
                {displayNode.description}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isPrompt && (
                <div
                  role="tablist"
                  aria-label="Detail view"
                  onKeyDown={handleTabsKeyDown}
                  className={pillToggleContainer}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "current"}
                    onClick={() => switchTab("current")}
                    className={cn(
                      pillToggle,
                      activeTab === "current"
                        ? pillToggleActive
                        : pillToggleInactive,
                    )}
                  >
                    Current
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "history"}
                    onClick={() => switchTab("history")}
                    className={cn(
                      pillToggle,
                      activeTab === "history"
                        ? pillToggleActive
                        : pillToggleInactive,
                    )}
                  >
                    History{" "}
                    <span className="font-normal opacity-70">
                      · {promptHistory.length}
                    </span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close detail"
                className="rounded-md p-1 text-foreground-muted transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="mt-6">
            {isPrompt ? (
              <div
                role="tabpanel"
                className={cn(
                  "transition-opacity duration-200 ease-out",
                  tabFading ? "opacity-0" : "opacity-100",
                )}
              >
                {shownTab === "current" ? (
                  <>
                    <TranslationInstructions />
                    <ModelSettings />
                    <OutputRequirements />
                    <TestRun />
                    <ReasoningTrace />
                  </>
                ) : (
                  <HistoryView />
                )}
              </div>
            ) : (
              <GenericDetail node={displayNode} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Simplified detail for non-prompt nodes — title/description live in the
 *  header; here we surface the node's key metadata. Fleshed out later. */
function GenericDetail({ node }: { node: PipelineNode }) {
  const entries = Object.entries(node.meta).filter(
    ([key]) => key !== "status" && key !== "editable",
  );

  return (
    <section className="space-y-4">
      <div className="font-mono text-sm text-foreground">{node.metricLine}</div>
      {node.previewLine && (
        <p className="text-sm italic text-foreground-muted">
          {node.previewLine}
        </p>
      )}

      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex items-baseline justify-between gap-4 border-b border-dashed border-border-subtle pb-1"
          >
            <dt className="text-xs uppercase tracking-wider text-foreground-muted">
              {formatKey(key)}
            </dt>
            <dd className="font-mono text-sm text-foreground">
              {formatValue(value)}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-foreground-muted">
        Full inspector for this stage is coming soon.
      </p>
    </section>
  );
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatValue(value: string | number | boolean | string[]): string {
  if (Array.isArray(value)) return value.join(" · ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
