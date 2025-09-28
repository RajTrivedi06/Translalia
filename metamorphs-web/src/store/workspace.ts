"use client";

import { create } from "zustand";
import { Version, CompareNode, JourneyItem } from "@/types/workspace";

type WorkspaceState = {
  projectId?: string;
  threadId?: string;
  workspaceName?: string | null;
  versions: Version[];
  compares: CompareNode[];
  journey: JourneyItem[];
  activeVersionId?: string;
  highlightVersionId?: string;
  selectedNodeId?: string | null;
  setSelectedNodeId: (id?: string | null) => void;
  overview: any | null;
  // TEMP alias for backward-compat (remove later)
  preview?: any | null;
  setProjectId: (id?: string) => void;
  setWorkspaceMeta: (id: string, name: string | null) => void;
  setThreadId: (id?: string) => void;
  setVersions: (vs: Version[]) => void;
  setJourney: (js: JourneyItem[]) => void;
  setCompares: (cs: CompareNode[]) => void;
  setActiveVersionId: (id?: string) => void;
  setHighlightVersionId: (id?: string) => void;
  activeCompare?: { leftId: string; rightId: string };
  setActiveCompare: (payload?: { leftId: string; rightId: string }) => void;
  compareOpen: boolean;
  setCompareOpen: (open: boolean) => void;
  resetThreadEphemera: () => void;
  addVersion: (v: Version) => void;
  addCompare: (c: CompareNode) => void;
  pinJourney: (j: JourneyItem) => void;
  setVersionPos: (id: string, pos: { x: number; y: number }) => void;
  tidyPositions: () => void;
  ui: {
    currentView: "line-selection" | "workshop" | "notebook";
    sidebarCollapsed: boolean;
    currentLine: number | null;
    targetLang?: string;
    targetStyle?: string;
    includeDialectOptions?: boolean;
  };
  setCurrentView: (v: "line-selection" | "workshop" | "notebook") => void;
  setSidebarCollapsed: (v: boolean) => void;
  setCurrentLine: (n: number | null) => void;
  setTargetLang: (v: string) => void;
  setTargetStyle: (v: string) => void;
  setIncludeDialectOptions: (v: boolean) => void;
  tokensSelections: Record<string, Record<string, string>>;
  workshopDraft: { notebookText: string };
  setTokenSelection: (
    lineId: string,
    tokenId: string,
    optionIdOrFreeText: string
  ) => void;
  clearSelections: (lineId?: string) => void;
  appendNotebook: (text: string) => void;
};

export const useWorkspace = create<WorkspaceState>((set) => ({
  projectId: undefined,
  threadId: undefined,
  workspaceName: null,
  versions: [
    { id: "A", title: "Version A", lines: ["…"], tags: ["literal"] },
    { id: "B", title: "Version B", lines: ["…"], tags: ["form:rhymed"] },
    {
      id: "C",
      title: "Version C",
      lines: ["…"],
      tags: ["dialect:code-switch"],
    },
  ],
  compares: [
    {
      id: "cmpAB",
      leftVersionId: "A",
      rightVersionId: "B",
      lens: "meaning",
      granularity: "line",
    },
  ],
  journey: [],
  activeVersionId: undefined,
  highlightVersionId: undefined,
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id ?? null }),
  overview: null,
  preview: null,
  setProjectId: (id) => set({ projectId: id }),
  setWorkspaceMeta: (id, name) => set({ projectId: id, workspaceName: name }),
  setThreadId: (id) => set({ threadId: id }),
  setVersions: (vs) => set({ versions: vs }),
  setJourney: (js) => set({ journey: js }),
  setCompares: (cs) => set({ compares: cs }),
  setActiveVersionId: (id) => set({ activeVersionId: id }),
  setHighlightVersionId: (id) => set({ highlightVersionId: id }),
  activeCompare: undefined,
  setActiveCompare: (payload) => set({ activeCompare: payload }),
  compareOpen: false,
  setCompareOpen: (open) => set({ compareOpen: open }),
  resetThreadEphemera: () =>
    set((s) => ({
      selectedNodeId: null,
      activeVersionId: undefined,
      highlightVersionId: undefined,
      activeCompare: undefined,
      compareOpen: false,
      // Phase 0: clear only safe UI ephemera for V2 shell
      ui: { ...s.ui, currentView: "line-selection", currentLine: null },
      tokensSelections: {},
      workshopDraft: { notebookText: "" },
    })),
  addVersion: (v) => set((s) => ({ versions: [...s.versions, v] })),
  addCompare: (c) => set((s) => ({ compares: [...s.compares, c] })),
  pinJourney: (j) => set((s) => ({ journey: [j, ...s.journey] })),
  setVersionPos: (id, pos) =>
    set((s) => ({
      versions: s.versions.map((v) => (v.id === id ? { ...v, pos } : v)),
    })),
  tidyPositions: () =>
    set((s) => ({
      versions: s.versions.map((v, i) => ({
        ...v,
        pos: { x: 120, y: 40 + i * 200 },
      })),
    })),
  ui: {
    currentView: "line-selection",
    sidebarCollapsed: false,
    currentLine: null,
    targetLang: "en",
    targetStyle: "balanced",
    includeDialectOptions: true,
  },
  setCurrentView: (v) => set((s) => ({ ui: { ...s.ui, currentView: v } })),
  setSidebarCollapsed: (v) =>
    set((s) => ({ ui: { ...s.ui, sidebarCollapsed: v } })),
  setCurrentLine: (n) => set((s) => ({ ui: { ...s.ui, currentLine: n } })),
  setTargetLang: (v) => set((s) => ({ ui: { ...s.ui, targetLang: v } })),
  setTargetStyle: (v) => set((s) => ({ ui: { ...s.ui, targetStyle: v } })),
  setIncludeDialectOptions: (v) => set((s) => ({ ui: { ...s.ui, includeDialectOptions: v } })),
  tokensSelections: {},
  workshopDraft: { notebookText: "" },
  setTokenSelection: (lineId, tokenId, optionIdOrFreeText) =>
    set((s) => ({
      tokensSelections: {
        ...s.tokensSelections,
        [lineId]: {
          ...(s.tokensSelections[lineId] || {}),
          [tokenId]: optionIdOrFreeText,
        },
      },
    })),
  clearSelections: (lineId?: string) =>
    set((s) =>
      lineId
        ? { tokensSelections: { ...s.tokensSelections, [lineId]: {} } }
        : { tokensSelections: {} }
    ),
  appendNotebook: (text: string) =>
    set((s) => ({ workshopDraft: { notebookText: s.workshopDraft.notebookText + text } })),
}));
