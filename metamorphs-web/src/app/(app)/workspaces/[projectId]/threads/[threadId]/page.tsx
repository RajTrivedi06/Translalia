import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export default function ThreadPage({
  params,
}: {
  params: { projectId: string; threadId: string };
}) {
  const { projectId, threadId } = params;
  return <WorkspaceShell projectId={projectId} threadId={threadId} />;
}
