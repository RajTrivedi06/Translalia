"use client";
import * as React from "react";
import { SourceTextCard } from "./sidebar/SourceTextCard";
import { AnalysisCard } from "./sidebar/AnalysisCard";
import { SettingsCard } from "./sidebar/SettingsCard";

export function ContextSidebar({ projectId, threadId }: { projectId?: string; threadId?: string | null }) {
  return (
    <aside className="h-full min-w-[320px] w-[28%] max-w-[420px] border-r overflow-y-auto bg-white dark:bg-neutral-950">
      <SourceTextCard projectId={projectId} threadId={threadId} />
      <div className="mx-3 my-1 h-px bg-neutral-200 dark:bg-neutral-800" />
      <AnalysisCard projectId={projectId} threadId={threadId} />
      <div className="mx-3 my-1 h-px bg-neutral-200 dark:bg-neutral-800" />
      <SettingsCard />
    </aside>
  );
}

export default ContextSidebar;
