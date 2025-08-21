"use client";

import { create } from "zustand";
import { Version, CompareNode, JourneyItem } from "@/types/workspace";

type WorkspaceState = {
  projectId?: string;
  threadId?: string;
  versions: Version[];
  compares: CompareNode[];
  journey: JourneyItem[];
  activeVersionId?: string;
  highlightVersionId?: string;
  setProjectId: (id?: string) => void;
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
  addVersion: (v: Version) => void;
  addCompare: (c: CompareNode) => void;
  pinJourney: (j: JourneyItem) => void;
  setVersionPos: (id: string, pos: { x: number; y: number }) => void;
  tidyPositions: () => void;
};

export const useWorkspace = create<WorkspaceState>((set) => ({
  projectId: undefined,
  threadId: undefined,
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
  setProjectId: (id) => set({ projectId: id }),
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
}));
