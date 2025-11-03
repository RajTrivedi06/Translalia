// src/state/uploads.ts
"use client";

import { create } from "zustand";

export type UploadStatus = "queued" | "uploading" | "done" | "error";

export type UploadItem = {
  name: string;
  size: number;
  path?: string; // storage path (present when uploaded)
  status: UploadStatus;
  error?: string;
};

type ThreadId = string | null;

type UploadsState = {
  byThread: Record<string, UploadItem[]>; // key null as "root"
  getKey: (threadId: ThreadId) => string;
  list: (threadId: ThreadId) => UploadItem[];

  hydrate: (threadId: ThreadId, items: UploadItem[]) => void;
  add: (threadId: ThreadId, item: UploadItem) => void;
  upsert: (
    threadId: ThreadId,
    match: (u: UploadItem) => boolean,
    next: (u?: UploadItem) => UploadItem
  ) => void;
  removeByName: (threadId: ThreadId, name: string) => void;
  setStatus: (
    threadId: ThreadId,
    name: string,
    status: UploadStatus,
    err?: string
  ) => void;
  clearThread: (threadId: ThreadId) => void;
};

export const useUploadsStore = create<UploadsState>((set, get) => ({
  byThread: {},
  getKey: (threadId) => threadId ?? "root",
  list: (threadId) => {
    const key = get().getKey(threadId);
    return get().byThread[key] ?? [];
  },

  hydrate: (threadId, items) =>
    set((s) => {
      const key = get().getKey(threadId);
      return { byThread: { ...s.byThread, [key]: items } };
    }),

  add: (threadId, item) =>
    set((s) => {
      const key = get().getKey(threadId);
      const prev = s.byThread[key] ?? [];
      return { byThread: { ...s.byThread, [key]: [...prev, item] } };
    }),

  upsert: (threadId, match, next) =>
    set((s) => {
      const key = get().getKey(threadId);
      const prev = s.byThread[key] ?? [];
      const idx = prev.findIndex(match);
      if (idx === -1) {
        return {
          byThread: { ...s.byThread, [key]: [...prev, next(undefined)] },
        };
      }
      const updated = [...prev];
      updated[idx] = next(prev[idx]);
      return { byThread: { ...s.byThread, [key]: updated } };
    }),

  removeByName: (threadId, name) =>
    set((s) => {
      const key = get().getKey(threadId);
      const prev = s.byThread[key] ?? [];
      return {
        byThread: { ...s.byThread, [key]: prev.filter((i) => i.name !== name) },
      };
    }),

  setStatus: (threadId, name, status, err) =>
    set((s) => {
      const key = get().getKey(threadId);
      const prev = s.byThread[key] ?? [];
      const updated = prev.map((i) =>
        i.name === name ? { ...i, status, error: err } : i
      );
      return { byThread: { ...s.byThread, [key]: updated } };
    }),

  clearThread: (threadId) =>
    set((s) => {
      const key = get().getKey(threadId);
      const copy = { ...s.byThread };
      delete copy[key];
      return { byThread: copy };
    }),
}));
