"use client";

interface ReflectionHeaderProps {
  showTitle?: boolean;
}

export function ReflectionHeader({ showTitle = true }: ReflectionHeaderProps) {
  return showTitle ? (
    <div className="px-4 py-3 border-b border-slate-200">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        Reflection
      </h2>
    </div>
  ) : null;
}
