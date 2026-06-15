import { cn } from "@/lib/utils";
import { SectionHeader } from "./SectionHeader";
import { editableValue as editableBase, textLink } from "../uiClasses";

// Inline editable value: the shared affordance, in accent + medium weight.
const editableValue = cn(editableBase, "font-medium text-accent");

export function TranslationInstructions() {
  return (
    <section className="space-y-3">
      <SectionHeader
        dot="success"
        title="Translation Instructions"
        status="Safe to edit"
        statusTone="success"
        right={
          <button type="button" className={cn("text-xs", textLink)}>
            Copy prompt →
          </button>
        }
      />

      <p className="text-sm leading-relaxed text-foreground">
        Translate the following line of poetry from Spanish into English.
      </p>
      <p className="text-sm leading-relaxed text-foreground">
        Produce three distinct variants that differ meaningfully in approach.
      </p>
      <p className="text-sm leading-relaxed text-foreground">
        Line to translate:{" "}
        <span className="rounded bg-accent-light/30 px-2 py-0.5 font-serif text-foreground">
          Hombres necios que acusáis…
        </span>
      </p>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground-muted">
        <span>Style:</span>
        <button type="button" className={editableValue}>
          Sonic-first
        </button>
        <span className="text-foreground-disabled">·</span>
        <span>Tone:</span>
        <button type="button" className={editableValue}>
          Formal-ish
        </button>
        <span className="text-foreground-disabled">·</span>
        <span>Liberty:</span>
        <button type="button" className={editableValue}>
          0.6
        </button>
      </p>

      <p className="text-sm italic text-foreground-muted">
        Preserve cultural references and respect Sor Juana Inés de la
        Cruz&apos;s voice. Do not flatten irony.
      </p>

      <p className="text-xs text-foreground-muted">
        1,184 chars · 286 tokens · 2 custom overrides
      </p>
    </section>
  );
}
