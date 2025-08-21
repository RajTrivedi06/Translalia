import * as React from "react";
import { use } from "react";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

type PageProps = {
  params?: Promise<{ projectId?: string | string[] }>;
  searchParams?: Promise<{ thread?: string | string[] }>;
};

export default function ProjectWorkspacePage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = use(
    params ?? Promise.resolve<{ projectId?: string | string[] }>({})
  );
  const resolvedSearch = use(
    searchParams ?? Promise.resolve<{ thread?: string | string[] }>({})
  );
  const value = resolvedParams.projectId;
  const projectId = Array.isArray(value) ? value[0] : value;
  const threadValue = resolvedSearch.thread;
  const threadId = Array.isArray(threadValue) ? threadValue[0] : threadValue;
  return <WorkspaceShell projectId={projectId} threadId={threadId} />;
}
