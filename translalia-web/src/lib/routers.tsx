import { Link } from "@/i18n/routing";
import * as React from "react";

/** Centralized app routes so you don’t hardcode strings everywhere. */
export const routes = {
  home: () => "/",
  workspaces: () => "/workspaces",
  workspaceChats: (projectId: string) => `/workspaces/${projectId}`,
  workspace: () => "/workspace",
  project: (projectId: string) => `/workspaces/${projectId}`,
  projectWithThread: (projectId: string, threadId: string) =>
    `/workspaces/${projectId}/threads/${encodeURIComponent(threadId)}`,
  // lightweight compare via query; use a dedicated page later if you prefer
  compare: (projectId: string, leftId: string, rightId: string) =>
    `/workspace/${projectId}?compare=${leftId}:${rightId}`,
} as const;

export type RouteKey = keyof typeof routes;
type RoutesMap = typeof routes;

type RouteFn<K extends RouteKey> = RoutesMap[K] extends (
  ...args: infer A
) => infer R
  ? (...args: A) => R
  : never;

type AppLinkProps<K extends RouteKey = RouteKey> = {
  to: K;
  params?: Parameters<RouteFn<K>>;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href">;

/** Small helper so you can write <AppLink to="workspace">Go</AppLink> */
export function AppLink<K extends RouteKey>({
  to,
  params,
  children,
  ...rest
}: AppLinkProps<K>) {
  const make = routes[to] as RouteFn<K>;
  const href = make(
    ...((params ?? []) as Parameters<RouteFn<K>>)
  ) as unknown as string;
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}
