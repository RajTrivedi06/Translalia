"use client";

import * as React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ChatPanel } from "./chat/ChatPanel";
import { VersionCanvas } from "./versions/VersionCanvas";
import { JourneyPanel } from "./journey/JourneyPanel";
import { useWorkspace } from "@/store/workspace";
import { supabase } from "@/lib/supabaseClient";
import type { Version, JourneyItem } from "@/types/workspace";
import { CompareSheet } from "./compare/CompareSheet";
import { useThreadId } from "@/hooks/useThreadId";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { routes } from "@/lib/routers";

export function WorkspaceShell({
  projectId,
  threadId,
}: {
  projectId?: string;
  threadId?: string;
}) {
  const urlThreadId = useThreadId();
  const effectiveThreadId = urlThreadId || threadId;
  const qc = useQueryClient();
  const setProjectId = useWorkspace((s) => s.setProjectId);
  const setThread = useWorkspace((s) => s.setThreadId);
  const setVersions = useWorkspace((s) => s.setVersions);
  const setJourney = useWorkspace((s) => s.setJourney);
  const setCompares = useWorkspace((s) => s.setCompares);
  const resetThreadEphemera = useWorkspace((s) => s.resetThreadEphemera);
  const versions = useWorkspace((s) => s.versions);
  const compareOpen = useWorkspace((s) => s.compareOpen);
  const setCompareOpen = useWorkspace((s) => s.setCompareOpen);
  const active = useWorkspace((s) => s.activeCompare);
  React.useEffect(() => setProjectId(projectId), [projectId, setProjectId]);
  React.useEffect(() => {
    if (effectiveThreadId) setThread(effectiveThreadId);
  }, [effectiveThreadId, setThread]);

  // Guard: if thread is not accessible, show small reason and redirect; do not bounce on 5xx
  React.useEffect(() => {
    if (!projectId || !effectiveThreadId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/flow/peek?threadId=${effectiveThreadId}`,
          {
            credentials: "include",
          }
        );
        if (res.status === 404 || res.status === 403 || res.status === 401) {
          let code = String(res.status);
          try {
            const json = await res.json();
            code = json?.code || code;
          } catch {}
          alert(`Chat not accessible (${code}). Returning to Chats.`);
          window.location.href = routes.workspaceChats(projectId);
        }
        // For 5xx, stay put; normal UI will surface errors and allow retry
      } catch {
        // ignore network errors; normal UI will handle
      }
    })();
  }, [projectId, effectiveThreadId]);

  // On thread change: clear nodes cache and selection, and reset local versions to avoid bleed
  React.useEffect(() => {
    if (projectId) {
      qc.invalidateQueries({ queryKey: ["nodes", projectId] });
      qc.invalidateQueries({ queryKey: ["citations", projectId] });
    }
    resetThreadEphemera();
    setVersions([]);
  }, [effectiveThreadId, qc, projectId, resetThreadEphemera, setVersions]);

  React.useEffect(() => {
    if (!projectId) return;
    (async () => {
      const [j, c] = await Promise.all([
        supabase
          .from("journey_items")
          .select(
            "id, kind, summary, from_version_id, to_version_id, compare_id, created_at"
          )
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("compares")
          .select(
            "id, left_version_id, right_version_id, lens, granularity, created_at"
          )
          .eq("project_id", projectId)
          .order("created_at", { ascending: true }),
      ]);

      // Load versions for the active thread only
      let versionsRows: Version[] = [];
      {
        const base = await supabase
          .from("versions")
          .select("id, title, lines, tags, meta, created_at")
          .eq("project_id", projectId)
          .filter("meta->>thread_id", "eq", effectiveThreadId)
          .order("created_at", { ascending: true });
        if (!base.error && Array.isArray(base.data)) {
          versionsRows = base.data as unknown as Version[];
        }
      }

      setVersions(versionsRows);
      if (!j.error && Array.isArray(j.data))
        setJourney(j.data as unknown as JourneyItem[]);
      if (!c.error && Array.isArray(c.data)) {
        const mapped = (
          c.data as Array<{
            id: string;
            left_version_id: string;
            right_version_id: string;
            lens: string;
            granularity: string;
          }>
        ).map((row) => ({
          id: row.id,
          leftVersionId: row.left_version_id,
          rightVersionId: row.right_version_id,
          lens:
            (row.lens as "meaning" | "form" | "tone" | "culture") ?? "meaning",
          granularity:
            (row.granularity as "line" | "phrase" | "char") ?? "line",
        }));
        setCompares(mapped);
      }
    })();
  }, [projectId, effectiveThreadId, setVersions, setJourney, setCompares]);

  return (
    // Fill the <main> area completely; use flex column so the panel group gets remaining height
    <div className="h-full w-full flex flex-col">
      {/* Thread topbar navigation */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-white/80 dark:bg-neutral-950/80 backdrop-blur px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">
            {useWorkspace.getState().workspaceName || "Workspace"}
          </div>
          <span className="text-xs text-neutral-500">/</span>
          {projectId ? (
            <Link
              href={routes.workspaceChats(projectId)}
              className="text-sm underline"
            >
              Chats
            </Link>
          ) : null}
        </div>
        {projectId ? (
          <Link href={routes.workspaceChats(projectId)} className="text-xs">
            <span className="inline-flex items-center rounded-md border px-2 py-1">
              Back to Chats
            </span>
          </Link>
        ) : null}
      </div>
      <PanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left: Chat */}
        <Panel
          defaultSize={24}
          minSize={18}
          className="min-h-0 min-w-0 border-r"
        >
          <ChatPanel projectId={projectId} />
        </Panel>
        <PanelResizeHandle className="w-2 bg-neutral-200" />
        {/* Middle: Versions Canvas */}
        <Panel
          key={`${projectId || "no-project"}:${effectiveThreadId || "pending"}`}
          defaultSize={52}
          minSize={40}
          className="min-h-0 min-w-0 border-r"
        >
          <VersionCanvas />
        </Panel>
        <PanelResizeHandle className="w-2 bg-neutral-200" />
        {/* Right: Journey / Summary */}
        <Panel defaultSize={24} minSize={18} className="min-h-0 min-w-0">
          <JourneyPanel />
        </Panel>
      </PanelGroup>
      {/* CompareSheet host */}
      {(() => {
        const left = versions.find((v) => v.id === active?.leftId);
        const right = versions.find((v) => v.id === active?.rightId);
        if (!left || !right) return null;
        return (
          <CompareSheet
            open={compareOpen}
            onOpenChange={setCompareOpen}
            left={left}
            right={right}
          />
        );
      })()}
    </div>
  );
}
