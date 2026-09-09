import type { ReactNode } from "react";

export function Section({
  title,
  sentence,
  children,
}: {
  title: string;
  sentence?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {sentence ? <p className="mt-1 text-sm text-foreground-secondary">{sentence}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-sm text-foreground-secondary">{children}</p>;
}
