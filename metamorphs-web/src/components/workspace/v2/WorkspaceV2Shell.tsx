"use client";
import * as React from "react";
import { useWorkspace } from "@/store/workspace";
import { ContextSidebar } from "./ContextSidebar";
import { MainWorkspace } from "./MainWorkspace";

export function WorkspaceV2Shell({
  projectId,
  threadId,
}: {
  projectId: string;
  threadId: string | null;
}) {
  const setProjectId = useWorkspace((s) => s.setProjectId);
  const setThreadId = useWorkspace((s) => s.setThreadId);
  React.useEffect(() => {
    setProjectId(projectId);
    setThreadId(threadId ?? undefined);
  }, [projectId, threadId, setProjectId, setThreadId]);

  return (
    <div className="grid h-[calc(100vh-56px)] grid-cols-[minmax(320px,28%),1fr] gap-0">
      <aside className="h-full min-w-[320px] border-r bg-white dark:bg-neutral-950">
        <ContextSidebar projectId={projectId} threadId={threadId} />
      </aside>
      <main className="h-full min-w-0">
        <MainWorkspace />
      </main>
    </div>
  );
}

export default WorkspaceV2Shell;
