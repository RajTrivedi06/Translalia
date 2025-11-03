"use client";

import * as React from "react";
import ThreadsDrawer from "./ThreadsDrawer";
import { useWorkspace } from "@/store/workspace";
import { useThreadMessages } from "@/hooks/useThreadMessages";
import { useNodes } from "@/hooks/useNodes";
import { supabase } from "@/lib/supabaseClient";
import AttachmentButton from "@/components/chat/AttachmentButton";
import UploadsTray from "@/components/chat/UploadsTray";
import UploadListItem from "@/components/chat/UploadListItem";
import { useUploadsStore } from "@/state/uploads";
import { useUploadsList, useUploadMutation } from "@/hooks/uploadsQuery";
import { assertOnline } from "@/lib/net/isOnline";
import { toastError } from "@/lib/ui/toast";
import { isSidebarLayoutEnabled } from "@/lib/featureFlags";

function renderContentWithCitations(
  content: string,
  onClickId: (id: string) => void
) {
  const parts: React.ReactNode[] = [];
  const regex = /\[v:([0-9a-fA-F-]{36})\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content))) {
    if (m.index > last) parts.push(content.slice(last, m.index));
    const id = m[1];
    parts.push(
      <button
        key={id + "-" + m.index}
        className="underline underline-offset-2 hover:no-underline text-blue-400"
        onClick={() => onClickId(id)}
        title={`Focus version ${id}`}
      >
        [v:{id}]
      </button>
    );
    last = regex.lastIndex;
  }
  if (last < content.length) parts.push(content.slice(last));
  return parts;
}

export function ChatPanel({
  projectId,
  threadId: pThreadId,
}: {
  projectId?: string;
  threadId?: string | null;
}) {
  const sidebarLayout = isSidebarLayoutEnabled();
  const [text, setText] = React.useState("");
  const [cites, setCites] = React.useState<string[]>([]);
  const { list, removeByName } = useUploadsStore();
  const threadIdFromStore = useWorkspace((s) => s.threadId);
  const threadId = (pThreadId ?? threadIdFromStore) as string | undefined;
  const tId = threadId ?? null;

  useUploadsList(tId);
  const items = list(tId);
  const uploadMut = useUploadMutation(tId);

  async function onFiles(files: FileList) {
    try {
      assertOnline();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "You're offline — try again later.";
      toastError(msg);
      return;
    }
    for (const f of Array.from(files)) {
      uploadMut.mutate(f);
    }
  }

  React.useEffect(() => {
    setCites([]);
  }, [threadId]);

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const {
    data: messages = [],
    refetch,
    isFetching,
  } = useThreadMessages(projectId, threadId);
  const { data: nodes } = useNodes(projectId, threadId || undefined);
  const inInstructionMode = (nodes?.length || 0) > 0;
  const [instruction, setInstruction] = React.useState("");

  React.useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  function toggleCite(id: string) {
    setCites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {!sidebarLayout && !threadId ? (
        <ThreadsDrawer projectId={projectId} />
      ) : null}
      {!sidebarLayout ? (
        <div className="border-b p-3 font-semibold">Chat</div>
      ) : null}
      {!sidebarLayout ? (
        <div className="flex-1 overflow-auto p-2 space-y-2 text-sm">
          {!threadId ? (
            <p className="text-neutral-500">
              Create or select a chat to start messaging.
            </p>
          ) : isFetching ? (
            <p className="text-neutral-500">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-neutral-500">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                onCiteClick={(id: string) => {
                  // Placeholder for future version citation handling
                  console.log("Cited version:", id);
                }}
              />
            ))
          )}
        </div>
      ) : null}
      {threadId ? (
        <div className="flex flex-col gap-2 border-t p-2">
          <UploadsTray
            items={items}
            renderItem={(it, i) => (
              <UploadListItem
                key={`${it.name}-${i}`}
                it={it}
                onRemove={() => removeByName(tId, it.name)}
                onDeleted={() => removeByName(tId, it.name)}
              />
            )}
          />
        </div>
      ) : null}

      {inInstructionMode && threadId ? (
        <div className="border-t p-3">
          <div className="mb-2 rounded-md border p-3 text-sm">
            <strong>Instruction mode active.</strong> Type your instruction for
            the nodes.
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Type your instruction..."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <button
              className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
              onClick={async () => {
                if (!instruction.trim() || !projectId || !threadId) return;
                // Placeholder for instruction handling
                console.log("Instruction:", instruction);
                setInstruction("");
              }}
            >
              Send
            </button>
          </div>
          <div className="mt-3">
            <AttachmentButton onFiles={onFiles} />
          </div>
        </div>
      ) : null}

      {!inInstructionMode ? (
        <form
          className="border-t p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim() || !threadId || !projectId) return;
            const value = text.trim();
            const existingTokens = new Set(
              Array.from(value.matchAll(/\[v:([^\]]+)\]/g)).map((m) => m[1])
            );
            const newTokens = cites
              .filter((id) => !existingTokens.has(id))
              .map((id) => `[v:${id}]`);
            const content = [value, ...newTokens]
              .filter(Boolean)
              .join(" ")
              .trim();

            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;
            const res = await fetch(`/api/chat/${threadId}/messages`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(accessToken
                  ? { Authorization: `Bearer ${accessToken}` }
                  : {}),
              },
              body: JSON.stringify({
                projectId,
                content,
                meta: cites.length ? { version_ids: cites } : {},
              }),
            });
            if (!res.ok) {
              const json = await res.json().catch(() => ({}));
              toastError(json?.error || "Failed to send");
              return;
            }

            setText("");
            setCites([]);
            await refetch();
          }}
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              type="submit"
              className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
            >
              Send
            </button>
          </div>
          <div className="mt-3">
            <AttachmentButton onFiles={onFiles} />
          </div>
          <div className="mt-3">
            <UploadsTray
              items={items}
              renderItem={(it, i) => (
                <UploadListItem
                  key={`${it.name}-${i}`}
                  it={it}
                  onRemove={() => removeByName(tId, it.name)}
                  onDeleted={() => removeByName(tId, it.name)}
                />
              )}
            />
          </div>
        </form>
      ) : null}
    </div>
  );
}

function MessageBubble({
  role,
  content,
  onCiteClick,
}: {
  role: string;
  content: string;
  onCiteClick: (id: string) => void;
}) {
  const rendered = React.useMemo(
    () => renderContentWithCitations(content, onCiteClick),
    [content, onCiteClick]
  );

  return (
    <div
      className={`rounded-md px-3 py-2 ${
        role === "user" ? "bg-neutral-100" : "bg-white border"
      }`}
    >
      <div className="mb-1 text-xs font-semibold uppercase text-neutral-500">
        {role}
      </div>
      <div className="whitespace-pre-wrap text-sm">{rendered}</div>
    </div>
  );
}
