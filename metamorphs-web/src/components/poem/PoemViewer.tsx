"use client";
export default function PoemViewer({ text }: { text: string }) {
  return (
    <pre
      className="whitespace-pre-wrap leading-relaxed text-sm"
      aria-label="Source poem"
    >
      {text}
    </pre>
  );
}
