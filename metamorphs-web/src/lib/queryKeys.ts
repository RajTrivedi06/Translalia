export const qkNotebookCells = (threadId: string | null | undefined) =>
  ["notebook-cells", threadId ?? null] as const;
