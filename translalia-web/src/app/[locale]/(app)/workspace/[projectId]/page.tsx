import { redirect } from "@/i18n/routing";

export default async function LegacyWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const { projectId } = await params;
  const { thread: tid } = await searchParams;
  if (tid) {
    redirect(`/workspaces/${projectId}/threads/${tid}`);
  }
  redirect(`/workspaces/${projectId}`);
}
