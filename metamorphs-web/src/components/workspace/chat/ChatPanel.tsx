"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import ThreadsDrawer from "./ThreadsDrawer";
import { useWorkspace } from "@/store/workspace";
import { useThreadMessages } from "@/hooks/useThreadMessages";
import { useNodes } from "@/hooks/useNodes";
import { supabase } from "@/lib/supabaseClient";
import { useInterviewFlow } from "@/hooks/useInterviewFlow";
import PlanBuilderOverviewSheet from "@/components/workspace/flow/PlanBuilderOverviewSheet";
import { routeIntent } from "@/server/flow/intent";
import { softReply } from "@/server/flow/softReplies";

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

export function ChatPanel({ projectId }: { projectId?: string }) {
  const [text, setText] = React.useState("");
  const [cites, setCites] = React.useState<string[]>([]);
  const addVersion = useWorkspace((s) => s.addVersion);
  const threadId = useWorkspace((s) => s.threadId);
  const {
    peek,
    start,
    answer,
    confirm,
    enhancer,
    translate,
    translatorPreview,
    acceptLines,
  } = useInterviewFlow(threadId);
  const phase = peek.data?.phase ?? "welcome";
  const nextQ = peek.data?.nextQuestion ?? null;
  const snapshot = peek.data?.snapshot ?? {
    poem_excerpt: "",
    collected_fields: {} as Record<string, unknown>,
  };
  const [planOpen, setPlanOpen] = React.useState(false);
  const [translatorOpen, setTranslatorOpen] = React.useState(false);
  const [translatorData, setTranslatorData] = React.useState<{
    lines: string[];
    notes: string[];
  } | null>(null);
  const [translatorError, setTranslatorError] = React.useState<string | null>(
    null
  );
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const versions = useWorkspace((s) => s.versions);
  const setActiveVersionId = useWorkspace((s) => s.setActiveVersionId);
  const setHighlightVersionId = useWorkspace((s) => s.setHighlightVersionId);
  const setSelectedNodeId = useWorkspace((s) => s.setSelectedNodeId);
  const {
    data: messages = [],
    refetch,
    isFetching,
  } = useThreadMessages(projectId, threadId);
  const { data: nodes } = useNodes(threadId || undefined);
  const inInstructionMode = (nodes?.length || 0) > 0;
  const [instruction, setInstruction] = React.useState("");
  const [citeVersionId, setCiteVersionId] = React.useState<string | "">("");
  const [assistantNotes, setAssistantNotes] = React.useState<string[]>([]);
  // Legacy /api/chat hook retained for the /prismatic command; not used otherwise
  const { mutate: _sendChatLegacy } = useMutation({
    mutationFn: async (payload: { text: string }) => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Chat send failed");
      return res.json();
    },
    onSuccess: () => {
      setText("");
    },
  });

  React.useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  React.useEffect(() => {
    (async () => {
      if (
        peek.data?.phase === "translating" &&
        !translatorData &&
        !translatorPreview.isPending &&
        process.env.NEXT_PUBLIC_FEATURE_TRANSLATOR === "1"
      ) {
        try {
          const pv = await translatorPreview.mutateAsync();
          setTranslatorData({
            lines: pv.preview.lines,
            notes: pv.preview.notes,
          });
          setTranslatorOpen(true);
          setTranslatorError(null);
        } catch (e) {
          setTranslatorError("Preview failed. Please retry.");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peek.data?.phase]);

  function toggleCite(id: string) {
    setCites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ThreadsDrawer projectId={projectId} />
      <div className="border-b p-3 font-semibold">Chat</div>
      <div className="flex-1 overflow-auto p-2 space-y-2 text-sm">
        {phase === "welcome" ? (
          <div className="mb-2 rounded-md border p-3 text-sm text-neutral-600 dark:text-neutral-300">
            <b>Welcome to Metamorphs.</b> Paste your poem or one stanza in a
            single message. Then answer a few short questions.
          </div>
        ) : null}
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
                setActiveVersionId(id);
                setHighlightVersionId(id);
              }}
            />
          ))
        )}
      </div>
      {false && translatorOpen && translatorData && (
        <div className="mb-3 rounded-lg border p-3 bg-neutral-50 dark:bg-neutral-900/40">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Translator preview</h3>
            <button
              className="text-xs underline"
              onClick={() => setTranslatorOpen(false)}
            >
              Hide
            </button>
          </div>
          {translatorError ? (
            <div className="text-sm text-red-600 flex items-center gap-2">
              <span>{translatorError}</span>
              <button
                className="text-xs underline"
                onClick={async () => {
                  try {
                    const pv = await translatorPreview.mutateAsync();
                    setTranslatorData({
                      lines: pv.preview.lines,
                      notes: pv.preview.notes,
                    });
                    setTranslatorError(null);
                  } catch {
                    setTranslatorError("Preview failed. Please retry.");
                  }
                }}
              >
                Retry
              </button>
            </div>
          ) : null}
          null
        </div>
      )}
      {threadId ? (
        <div className="flex flex-col gap-2 border-t p-2">
          {!inInstructionMode ? (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-neutral-500">Cite version:</span>
              {versions.map((v) => {
                const active = cites.includes(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleCite(v.id)}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      active
                        ? "bg-neutral-900 text-white"
                        : "hover:bg-neutral-100"
                    }`}
                    title={`Insert [v:${v.id}]`}
                  >
                    {v.id}
                  </button>
                );
              })}
            </div>
          ) : null}
          {inInstructionMode ? (
            <div className="space-y-2">
              <div className="text-xs text-neutral-500">Instruction mode</div>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-md border px-3 py-2 text-sm"
                  placeholder="Give instructions (e.g., 'Try dialect X; evoke Poet Y')"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                />
                <select
                  className="rounded-md border px-2 py-2 text-sm"
                  value={citeVersionId}
                  onChange={(e) => setCiteVersionId(e.target.value)}
                >
                  <option value="">Cite version (optional)</option>
                  {(nodes || []).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.display_label || n.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-md bg-neutral-900 text-white px-3 py-2 text-sm disabled:opacity-60"
                  disabled={!instruction.trim() || !threadId}
                  onClick={async () => {
                    const payload = {
                      threadId,
                      instruction: instruction.trim(),
                      citeVersionId: citeVersionId || undefined,
                    };
                    const res = await fetch("/api/translator/instruct", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify(payload),
                    });
                    const json = await res.json().catch(() => ({}));
                    const label = json?.displayLabel || "the next version";
                    const reply = [
                      `Understood: ${payload.instruction.slice(0, 120)}${
                        payload.instruction.length > 120 ? "…" : ""
                      }`,
                      `Creating ${label} ${
                        payload.citeVersionId ? "(with cited version)" : ""
                      }…`,
                    ].join("\n");
                    setAssistantNotes((prev) => [...prev, reply]);
                    if (res.ok && json?.versionId) {
                      setSelectedNodeId(json.versionId as string);
                      setPlanOpen(true);
                      setInstruction("");
                    }
                  }}
                >
                  Send
                </button>
              </div>
              {assistantNotes.length ? (
                <div className="text-xs text-neutral-500 whitespace-pre-wrap">
                  {assistantNotes.slice(-3).join("\n\n")}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!inInstructionMode ? (
        <form
          className="border-t p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim() || !threadId || !projectId) return;
            const value = text.trim();
            // Hidden command: /prismatic\n<text>
            if (value.startsWith("/prismatic")) {
              const payload = value
                .replace(/^\/prismatic\s*/, "")
                .replace(/^\n/, "");
              // still append locally for UX
              const res = await fetch("/api/variants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ input: payload, recipe: "prismatic" }),
              });
              const variants = (await res.json()) as Array<{
                id: string;
                title: string;
                lines: string[];
                tags: string[];
              }>;
              const first = variants?.[0];
              if (first) {
                // persist the variant via versions API
                const save = await fetch("/api/versions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    projectId,
                    title: first.title,
                    lines: first.lines,
                    tags: first.tags ?? ["prismatic"],
                    meta: { recipe: "prismatic" },
                    summary: `Generated variant "${first.title}"`,
                  }),
                });
                const saved = await save.json();
                if (save.ok) {
                  addVersion({
                    id: saved.version.id,
                    title: saved.version.title,
                    lines: saved.version.lines,
                    tags: saved.version.tags ?? [],
                  });
                } else {
                  alert(saved?.error ?? "Failed to save version");
                }
                await refetch();
              }
              setText("");
              return;
            }
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
              alert(json?.error || "Failed to send");
              return;
            }
            // Intent routing
            try {
              const routed = routeIntent(value, phase);
              let intent = routed.intent;
              const confidence = routed.confidence;
              if (
                confidence === "low" &&
                process.env.NEXT_PUBLIC_FEATURE_ROUTER === "1"
              ) {
                const r = await fetch(`/api/flow/intent`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ message: value, phase }),
                });
                const j = await r.json().catch(() => ({}));
                if (j?.intent && typeof j.intent === "string")
                  intent = j.intent as typeof intent;
              }

              if (intent === "poem_input" && phase === "welcome") {
                const started = (await start.mutateAsync(value)) as {
                  phase: string;
                  nextQuestion: { id: string; prompt: string };
                };
                if (started?.nextQuestion?.prompt) {
                  await fetch(`/api/chat/${threadId}/messages`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(accessToken
                        ? { Authorization: `Bearer ${accessToken}` }
                        : {}),
                    },
                    body: JSON.stringify({
                      projectId,
                      role: "system",
                      content: started.nextQuestion.prompt,
                    }),
                  });
                }
              } else if (
                intent === "interview_answer" &&
                phase === "interviewing" &&
                nextQ
              ) {
                const answered = (await answer.mutateAsync({
                  questionId: nextQ.id,
                  answer: value,
                })) as {
                  phase: string;
                  nextQuestion?: { id: string; prompt: string } | null;
                };
                if (answered?.nextQuestion?.prompt) {
                  await fetch(`/api/chat/${threadId}/messages`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(accessToken
                        ? { Authorization: `Bearer ${accessToken}` }
                        : {}),
                    },
                    body: JSON.stringify({
                      projectId,
                      role: "system",
                      content: answered.nextQuestion.prompt,
                    }),
                  });
                }
                if (answered?.phase === "await_plan_confirm") {
                  setPlanOpen(true);
                }
              } else if (
                intent === "looks_good" &&
                phase === "await_plan_confirm"
              ) {
                setPlanOpen(true);
              } else {
                const reply = softReply(intent, phase);
                if (reply) {
                  await fetch(`/api/chat/${threadId}/messages`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(accessToken
                        ? { Authorization: `Bearer ${accessToken}` }
                        : {}),
                    },
                    body: JSON.stringify({
                      projectId,
                      role: "assistant",
                      content: reply,
                    }),
                  });
                }
              }
            } catch (err) {
              // ignore and proceed; errors surface via toasts elsewhere
            }
            setText("");
            setCites([]);
            await refetch();
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
            <input
              aria-label="Chat input"
              className="w-full bg-transparent outline-none"
              placeholder={
                threadId
                  ? "Type a message…"
                  : "Create or select a chat to start"
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              ref={inputRef}
              disabled={!threadId}
            />
            {false ? (
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-xs"
                onClick={async () => {
                  setTranslatorOpen(true);
                  if (!translatorData) {
                    try {
                      const pv = await translatorPreview.mutateAsync();
                      setTranslatorData({
                        lines: pv.preview.lines,
                        notes: pv.preview.notes,
                      });
                      setTranslatorError(null);
                    } catch {
                      setTranslatorError("Preview failed. Please retry.");
                    }
                  }
                }}
              >
                Show translator
              </button>
            ) : null}
            <button
              type="submit"
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-white"
              disabled={!threadId || !projectId}
              aria-label="Send message"
            >
              Send
            </button>
          </div>
        </form>
      ) : null}
      <PlanBuilderOverviewSheet
        threadId={threadId || ""}
        open={planOpen}
        onOpenChange={setPlanOpen}
      />
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
      <span>{rendered}</span>
    </div>
  );
}
