import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { isSidebarLayoutEnabled } from "@/lib/featureFlags";
import { WorkspaceV2Shell } from "@/components/workspace/v2/WorkspaceV2Shell";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ projectId: string; threadId: string }>;
}) {
  const { projectId, threadId } = await params;
  const sidebarEnabled = isSidebarLayoutEnabled();
  if (sidebarEnabled) {
    return <WorkspaceV2Shell projectId={projectId} threadId={threadId} />;
  }
  return <WorkspaceShell projectId={projectId} threadId={threadId} />;
}
