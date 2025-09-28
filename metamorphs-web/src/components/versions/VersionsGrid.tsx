"use client";
import VersionCard from "./VersionCard";
export type Version = {
  id: "A" | "B" | "C";
  title: string;
  text: string;
  meta?: { model?: string; promptPreview?: string };
};
export default function VersionsGrid({
  versions,
  source,
}: {
  versions: Version[];
  source?: string;
}) {
  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl border p-3 bg-slate-50"
        aria-label="Pinned source"
      >
        <div className="text-xs font-semibold mb-1">Source</div>
        <pre className="whitespace-pre-wrap text-sm">{source ?? "—"}</pre>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {versions.map((v) => (
          <VersionCard
            key={v.id}
            title={`${v.id}: ${v.title}`}
            text={v.text}
            meta={v.meta}
          />
        ))}
      </div>
    </div>
  );
}
