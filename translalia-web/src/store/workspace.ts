"use client";

import { create } from "zustand";

type WorkspaceState = {
  projectId?: string;
  threadId?: string;
  workspaceName?: string | null;
  setProjectId: (id?: string) => void;
  setWorkspaceMeta: (id: string, name: string | null) => void;
  setThreadId: (id?: string) => void;
};

export const useWorkspace = create<WorkspaceState>((set) => ({
  projectId: undefined,
  threadId: undefined,
  workspaceName: null,
  setProjectId: (id) => set({ projectId: id }),
  setWorkspaceMeta: (id, name) => set({ projectId: id, workspaceName: name }),
  setThreadId: (id) => set({ threadId: id }),
}));
