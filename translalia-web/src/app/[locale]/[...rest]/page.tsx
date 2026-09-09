import { notFound } from "next/navigation";
import { getAdmin } from "@/server/admin/requireAdmin";
import { AdminOverviewPage } from "@/components/admin/AdminOverviewPage";

// Cookie-bound: never statically rendered.
export const dynamic = "force-dynamic";

/**
 * Catch-all for every unmatched path under a locale, and the home of /admin.
 *
 * The admin page deliberately lives here rather than in its own route
 * segment. A route of its own would give /admin a different RSC router tree
 * from an unknown URL, and the not-found body would differ by those segments
 * even when both return 404. Sharing one segment tree and one notFound() call
 * site makes a gated /admin byte-identical to /any-unknown-path for anyone
 * who is not on the admin list, signed in or not.
 */
export default async function CatchAll({
  params,
}: {
  params: Promise<{ locale: string; rest: string[] }>;
}) {
  const { rest } = await params;
  const admin = rest.length === 1 && rest[0] === "admin" ? await getAdmin() : null;
  if (!admin) notFound();

  return <AdminOverviewPage sb={admin.sb} />;
}
