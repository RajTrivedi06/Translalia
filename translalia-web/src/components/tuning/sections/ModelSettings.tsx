import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./SectionHeader";
import { editableValue as editableBase } from "../uiClasses";

// Editable model value: the shared affordance, in monospace.
const editableValue = cn(editableBase, "font-mono text-foreground");

export function ModelSettings() {
  return (
    <section className="my-2 border-t border-dashed border-border-subtle py-6">
      <SectionHeader
        dot="warning"
        title="Model Settings"
        status="Changes output quality"
        statusTone="warning"
      />

      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <button type="button" className={editableValue}>
          gpt-4o-mini
        </button>
        <span className="text-foreground-disabled">·</span>
        <span className="text-foreground-muted">Temperature</span>
        <button type="button" className={editableValue}>
          0.7
        </button>
        <span className="text-foreground-disabled">·</span>
        <span className="text-foreground-muted">Max Tokens</span>
        <button type="button" className={editableValue}>
          4000
        </button>
        <span className="text-foreground-disabled">·</span>
        <span className="text-foreground-muted">Reasoning</span>
        <button
          type="button"
          className={cn(editableValue, "inline-flex items-center gap-1")}
        >
          medium
          <ChevronDown size={12} className="text-foreground-muted" />
        </button>
      </p>
    </section>
  );
}
