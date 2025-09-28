"use client";

import Link from "next/link";
import * as React from "react";
import { useWorkspace } from "@/store/workspace";

type Props = {
  workspaceId: string;
  threadTitle?: string;
  showNewChat?: boolean;
  NewChatButton?: React.ReactNode;
};

export default function Breadcrumbs({
  workspaceId,
  threadTitle,
  showNewChat,
  NewChatButton,
}: Props) {
  const workspaceName = useWorkspace((s) => s.workspaceName) || "Workspace";
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-white/80 dark:bg-neutral-950/80 backdrop-blur px-4 py-2">
      <nav className="flex items-center gap-2 text-sm">
        <span className="font-semibold">{workspaceName}</span>
        <span className="text-neutral-500">/</span>
        <Link href={`/workspaces/${workspaceId}`} className="underline">
          Chats
        </Link>
        {threadTitle ? (
          <>
            <span className="text-neutral-500">/</span>
            <span>{threadTitle}</span>
          </>
        ) : null}
      </nav>
      <div className="flex items-center gap-2">
        {showNewChat ? NewChatButton : null}
      </div>
    </div>
  );
}
