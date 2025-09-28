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
      <div className="p-3">
        <SourceTextCard projectId={projectId} threadId={threadId} />
      </div>
      <Separator />
      <div className="p-3">
        <AnalysisCard projectId={projectId} threadId={threadId} />
      </div>
      <Separator />
      <div className="p-3">
        <SettingsCard />
      </div>
    </div>
  );
}

export default ContextSidebar;
