import ThreadPageClient from "./ThreadPageClient";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ projectId: string; threadId: string }>;
}) {
  const { projectId, threadId } = await params;
  return (
    <ThreadPageClient projectId={projectId} threadId={threadId} />
  );
}
