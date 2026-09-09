export function StatTile({
  value,
  label,
  sentence,
}: {
  value: string;
  label: string;
  sentence: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-5 shadow-card">
      <div className="text-4xl font-semibold tabular-nums tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{label}</div>
      <p className="mt-2 text-sm leading-snug text-foreground-secondary">{sentence}</p>
    </div>
  );
}
