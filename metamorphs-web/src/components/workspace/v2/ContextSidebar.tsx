"use client";
import * as React from "react";
import { SourceTextCard } from "./sidebar/SourceTextCard";
import { AnalysisCard } from "./sidebar/AnalysisCard";
import { SettingsCard } from "./sidebar/SettingsCard";
import Separator from "@/components/ui/separator";

export function ContextSidebar({
  projectId,
  threadId,
}: {
  projectId: string;
  threadId: string | null;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <section role="region" aria-labelledby="source-title" className="p-3">
        <h2 id="source-title" className="text-sm font-semibold">
          Source
        </h2>
        <div className="mt-2">
          <SourceTextCard projectId={projectId} threadId={threadId} />
        </div>
      </section>
      <Separator />
      <section role="region" aria-labelledby="analysis-title" className="p-3">
        <h2 id="analysis-title" className="text-sm font-semibold">
          Analysis
        </h2>
        <div className="mt-2">
          <AnalysisCard projectId={projectId} threadId={threadId} />
        </div>
      </section>
      <Separator />
      <section role="region" aria-labelledby="settings-title" className="p-3">
        <h2 id="settings-title" className="text-sm font-semibold">
          Settings
        </h2>
        <div className="mt-2">
          <SettingsCard />
        </div>
      </section>
    </div>
  );
}

export default ContextSidebar;
