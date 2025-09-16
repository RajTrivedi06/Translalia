import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ projectId: string; threadId: string }>;
}) {
  const { projectId, threadId } = await params;
  return <WorkspaceShell projectId={projectId} threadId={threadId} />;
}
