import { redirect } from "next/navigation";

export default function LegacyWorkspacePage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { thread?: string };
}) {
  const { projectId } = params;
  const tid = searchParams?.thread;
  if (tid) {
    redirect(`/workspaces/${projectId}/threads/${tid}`);
  }
  redirect(`/workspaces/${projectId}`);
}
