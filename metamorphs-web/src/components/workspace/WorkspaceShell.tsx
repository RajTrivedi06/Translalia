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

export function WorkspaceShell({
  projectId,
  threadId,
}: {
  projectId?: string;
  threadId?: string;
}) {
  const setProjectId = useWorkspace((s) => s.setProjectId);
  const setThread = useWorkspace((s) => s.setThreadId);
  const setVersions = useWorkspace((s) => s.setVersions);
  const setJourney = useWorkspace((s) => s.setJourney);
  const setCompares = useWorkspace((s) => s.setCompares);
  const versions = useWorkspace((s) => s.versions);
  const compareOpen = useWorkspace((s) => s.compareOpen);
  const setCompareOpen = useWorkspace((s) => s.setCompareOpen);
  const active = useWorkspace((s) => s.activeCompare);
  React.useEffect(() => setProjectId(projectId), [projectId, setProjectId]);
  React.useEffect(() => {
    if (threadId) setThread(threadId);
  }, [threadId, setThread]);

  React.useEffect(() => {
    if (!projectId) return;
    (async () => {
      const [v, j, c] = await Promise.all([
        supabase
          .from("versions")
          .select("id, title, lines, tags, meta, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true }),
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
      if (!v.error && Array.isArray(v.data))
        setVersions(v.data as unknown as Version[]);
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
  }, [projectId, setVersions, setJourney, setCompares]);

  return (
    // Fill the <main> area completely; no card/chrome around the panels
    <div className="h-full w-full">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Left: Chat */}
        <Panel defaultSize={24} minSize={18} className="min-h-0 border-r">
          <ChatPanel projectId={projectId} />
        </Panel>
        <PanelResizeHandle className="w-2 bg-neutral-200" />
        {/* Middle: Versions Canvas */}
        <Panel defaultSize={52} minSize={40} className="min-h-0 border-r">
          <VersionCanvas />
        </Panel>
        <PanelResizeHandle className="w-2 bg-neutral-200" />
        {/* Right: Journey / Summary */}
        <Panel defaultSize={24} minSize={18} className="min-h-0">
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
