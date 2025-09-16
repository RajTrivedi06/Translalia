"use client";

import React from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Position,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { VersionCardNode } from "./nodes/VersionCardNode";
import { CompareCardNode } from "./nodes/CompareCardNode";
import { useWorkspace } from "@/store/workspace";
import { useNodes, type NodeRow } from "@/hooks/useNodes";
import { useThreadId } from "@/hooks/useThreadId";
import { Wand2 } from "lucide-react";
import { useJourney } from "@/hooks/useJourney";
import { JourneyList } from "@/components/workspace/journey/JourneyList";
import { supabase } from "@/lib/supabaseClient";

export function VersionCanvas() {
  const nodeTypes = React.useMemo(
    () => ({ versionCard: VersionCardNode, compareCard: CompareCardNode }),
    []
  );
  const versions = useWorkspace((s) => s.versions);
  const compares = useWorkspace((s) => s.compares);
  const setVersionPos = useWorkspace((s) => s.setVersionPos);
  const tidyPositions = useWorkspace((s) => s.tidyPositions);
  const projectId = useWorkspace((s) => s.projectId);
  const threadIdFromStore = useWorkspace((s) => s.threadId);
  const threadId = useThreadId() || threadIdFromStore || undefined;
  const addCompare = useWorkspace((s) => s.addCompare);
  const setActiveCompare = useWorkspace((s) => s.setActiveCompare);
  const setCompareOpen = useWorkspace((s) => s.setCompareOpen);
  const setSelectedNodeId = useWorkspace((s) => s.setSelectedNodeId);
  const highlightVersionId = useWorkspace((s) => s.highlightVersionId);
  const rfRef = React.useRef<ReactFlowInstance | null>(null);
  const {
    data: journeyData,
    isLoading: journeyLoading,
    error: journeyError,
  } = useJourney(projectId, 10);

  const [selectedVersionIds, setSelectedVersionIds] = React.useState<string[]>(
    []
  );
  const canCompare = selectedVersionIds.length === 2;

  // Nodes API (Phase 2+) — used for rendering version nodes with labels/overview
  const { data: nodesData } = useNodes(projectId, threadId);
  // Temporary debug to verify thread-scoped rendering
  // console.debug("[NodesRender]", { projectId, threadId, count: (nodesData || []).length });
  const apiNodes: NodeRow[] = React.useMemo(() => nodesData || [], [nodesData]);

  // Build a linear lineage from the root (no parent) to the last child.
  // Falls back to created order if we can’t find a chain.
  const lineageIds = React.useMemo(() => {
    if (!apiNodes.length) return [] as string[];

    // Map for quick lookup (reserved for future use)
    // const byId = new Map(apiNodes.map((n) => [n.id, n]));

    // Root = first node with no parent; else, earliest by created_at
    const root = apiNodes.find((n) => !n.parent_version_id) ?? apiNodes[0];

    // Walk child → child by matching parent_version_id
    const seq: string[] = [];
    const seen = new Set<string>();
    let cur: NodeRow | undefined = root;

    while (cur && !seen.has(cur.id)) {
      seq.push(cur.id);
      seen.add(cur.id);
      cur = apiNodes.find((n) => n.parent_version_id === cur!.id);
    }

    // If we couldn’t chain all, append any stragglers (stable)
    const remaining = apiNodes
      .map((n) => n.id)
      .filter((id) => !seq.includes(id));
    return [...seq, ...remaining];
  }, [apiNodes]);
  // Saved positions are not used for vertical spacing, but we keep X when snapping
  const posById = React.useMemo(
    () => new Map(versions.map((v) => [v.id, v.pos])),
    [versions]
  );

  const savePositions = React.useCallback(async () => {
    if (!projectId) return;
    const payload = versions
      .filter((v) => !!v.pos)
      .map((v) => ({ id: v.id, pos: v.pos! }));
    if (!payload.length) return;
    await fetch("/api/versions/positions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, positions: payload }),
    });
  }, [projectId, versions]);

  const nodes = React.useMemo<Node[]>(() => {
    const X = 120; // left margin
    const TOP = 40; // top padding
    const GAP_Y = 260; // vertical distance between cards

    // Build a quick index of NodeRow by id
    const byId = new Map(apiNodes.map((n) => [n.id, n]));

    // Render in lineage order so A→B→C visually stacks
    const ordered = lineageIds.map((id) => byId.get(id)!).filter(Boolean);

    const versionNodes = ordered.map((api, idx) => {
      const title = api.display_label ?? "Version";
      const status = (api.status ?? "generated") as string;
      const overviewLines: string[] = Array.isArray(api.overview?.lines)
        ? (api.overview!.lines as string[])
        : [];

      return {
        id: api.id,
        type: "versionCard" as const,
        position: { x: X, y: TOP + idx * GAP_Y }, // equal spacing
        targetPosition: Position.Top, // child receives at top
        sourcePosition: Position.Bottom, // parent sends from bottom
        data: {
          id: api.id,
          highlight: highlightVersionId === api.id,
          title,
          status,
          overviewLines,
        },
      };
    });

    // Keep compare nodes where they are (right column)
    const compareNodes = compares.map((c, i) => ({
      id: c.id,
      type: "compareCard" as const,
      position: { x: 420, y: 160 + i * 220 },
      data: { leftId: c.leftVersionId, rightId: c.rightVersionId },
    }));

    return [...versionNodes, ...compareNodes];
  }, [apiNodes, lineageIds, compares, highlightVersionId]);

  const edges = React.useMemo<Edge[]>(() => {
    // A→B→C→D lineage from API (parent_version_id → id)
    const lineage: Edge[] = (apiNodes || [])
      .filter((n) => !!n.parent_version_id)
      .map((n) => ({
        id: `lineage:${String(n.parent_version_id)}->${n.id}`,
        source: String(n.parent_version_id),
        target: n.id,
        type: "straight", // clean vertical line
        markerEnd: { type: MarkerType.ArrowClosed },
      }));

    // Existing compare edges (unchanged)
    const compareEdges: Edge[] = compares.flatMap((c) => [
      {
        id: `${c.leftVersionId}->${c.id}`,
        source: c.leftVersionId,
        target: c.id,
      },
      {
        id: `${c.rightVersionId}->${c.id}`,
        source: c.rightVersionId,
        target: c.id,
      },
    ]);

    return [...lineage, ...compareEdges];
  }, [apiNodes, compares]);

  const onNodeDragStop = React.useCallback(
    (_e: unknown, node: Node) => {
      if (node.type !== "versionCard") return;
      const GAP_Y = 260;
      const TOP = 40;
      const idx = Math.round((node.position.y - TOP) / GAP_Y);
      const snappedY = TOP + Math.max(0, idx) * GAP_Y;
      const snapped = { x: node.position.x, y: snappedY };
      setVersionPos(node.id, snapped);
      // debounce persist
      clearTimeout((window as unknown as { __posTimer?: number }).__posTimer);
      (window as unknown as { __posTimer?: number }).__posTimer =
        window.setTimeout(savePositions, 350);
    },
    [setVersionPos, savePositions]
  );

  const onSelectionChange = React.useCallback(
    ({
      nodes,
    }: {
      nodes: Array<{ id: string; type?: string; selected?: boolean }>;
    }) => {
      const ids = nodes
        .filter((n) => n.type === "versionCard" && n.selected)
        .map((n) => n.id);
      setSelectedVersionIds(ids);
    },
    []
  );

  React.useEffect(() => {
    if (!highlightVersionId) return;
    const inst = rfRef.current;
    if (inst) {
      try {
        inst.fitView({
          nodes: [{ id: highlightVersionId }],
          padding: 0.2,
          duration: 500,
        });
      } catch {
        // ignore
      }
    }
    const timer = window.setTimeout(() => {
      useWorkspace.getState().setHighlightVersionId(undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [highlightVersionId]);

  async function onCompareClick() {
    if (!projectId || !canCompare) return;
    const [leftId, rightId] = selectedVersionIds;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const res = await fetch("/api/compares", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        projectId,
        leftId,
        rightId,
        lens: "meaning",
        granularity: "line",
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error ?? "Failed to create compare");
      return;
    }
    addCompare({
      id: json.compare.id,
      leftVersionId: json.compare.left_version_id,
      rightVersionId: json.compare.right_version_id,
      lens: json.compare.lens,
      granularity: json.compare.granularity,
    });
    setActiveCompare({ leftId, rightId });
    setCompareOpen(true);
  }

  return (
    <div className="relative h-full w-full overflow-hidden min-w-0">
      {/* Simple nodes list overlay (ensures we render API nodes and allow selection) */}
      <div className="absolute left-3 bottom-3 z-10 max-h-[40%] w-80 overflow-y-auto rounded-md border bg-white/90 p-2 shadow">
        <div className="mb-1 text-xs font-semibold">Nodes</div>
        {!threadId ? (
          <div className="text-xs text-neutral-500">No thread</div>
        ) : apiNodes.length === 0 ? (
          <div className="text-xs text-neutral-500">No nodes yet</div>
        ) : (
          <ul className="space-y-1">
            {apiNodes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(n.id)}
                  className="w-full rounded border bg-white px-2 py-1 text-left hover:bg-neutral-50"
                  title={n.display_label || n.id}
                >
                  <div className="text-xs font-medium">
                    {n.display_label || "Version ?"}
                  </div>
                  <div className="mt-0.5 text-[10px] text-neutral-500">
                    {n.status === "placeholder"
                      ? `Creating ${n.display_label || "Version …"}…`
                      : (n.overview?.lines || []).slice(0, 2).join("\n") ||
                        "No overview yet"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          onClick={tidyPositions}
          className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs shadow"
          aria-label="Tidy graph"
        >
          <Wand2 className="h-3.5 w-3.5" /> Tidy
        </button>
        <button
          type="button"
          onClick={onCompareClick}
          disabled={!canCompare}
          className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs shadow disabled:opacity-50"
          title={
            canCompare
              ? `Compare ${selectedVersionIds[0]} vs ${selectedVersionIds[1]}`
              : "Select two version nodes"
          }
        >
          Compare
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={{
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 3 },
        }}
        proOptions={{ hideAttribution: true }}
        panOnScroll
        zoomOnDoubleClick={false}
        minZoom={0.5}
        maxZoom={1.5}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={
          onSelectionChange as unknown as (params: unknown) => void
        }
        onInit={(inst) => {
          rfRef.current = inst;
        }}
      >
        <Background />
        <Controls />
      </ReactFlow>
      {/* Activity overlay (top-left) */}
      <div className="absolute left-3 top-3 z-10 max-h-[40%] w-72 overflow-y-auto rounded-md border bg-white/90 p-2 shadow">
        <div className="mb-1 text-xs font-semibold">Activity</div>
        {journeyLoading ? (
          <div className="text-xs">Loading…</div>
        ) : journeyError ? (
          <div className="text-xs text-red-600">Failed to load</div>
        ) : (
          <JourneyList
            items={(journeyData?.items || []).map((it) => ({
              id: it.id,
              kind: it.kind,
              summary: it.summary,
              meta: (it.meta as Record<string, unknown>) ?? null,
              created_at: it.created_at,
            }))}
          />
        )}
      </div>
    </div>
  );
}
