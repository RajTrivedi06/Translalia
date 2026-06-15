import { SectionHeader } from "./SectionHeader";

export function OutputRequirements() {
  return (
    // Lower opacity keeps this locked section visually quieter than the
    // editable ones above it.
    <section className="my-2 border-t border-dashed border-border-subtle py-6 opacity-75">
      <SectionHeader
        dot="error"
        title="Output Requirements"
        status="Locked"
        statusTone="error"
      />

      <p className="mt-3 text-sm leading-relaxed">
        <span className="font-medium text-foreground">
          3 variants · JSON schema · required fields.
        </span>{" "}
        <span className="text-foreground-muted">
          These requirements ensure the application works correctly — variant
          count, schema, and field names cannot be changed.
        </span>
      </p>
    </section>
  );
}
