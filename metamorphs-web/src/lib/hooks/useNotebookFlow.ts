"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qkNotebookCells } from "@/lib/queryKeys";
import { NotebookCell, NotebookCellUpdate, ExportFormat } from "@/types/notebook";

interface ApiError {
  error?: {
    code: string;
    message: string;
    details?: string;
    upstream?: string;
  };
}

interface FetchCellsResponse {
  cells: NotebookCell[];
}

interface UpdateCellParams {
  threadId: string;
  lineIndex: number;
  updates: NotebookCellUpdate;
}

interface UpdateCellResponse {
  cell: NotebookCell;
}

interface GeneratePrismaticParams {
  threadId: string;
  lineIndex: number;
  sourceText: string;
}

interface GeneratePrismaticResponse {
  variants: Array<{
    label: 'A' | 'B' | 'C';
    text: string;
    rationale: string;
    confidence: number;
  }>;
}

interface ToggleLockParams {
  threadId: string;
  lineIndex: number;
  wordPositions: number[];
}

interface ToggleLockResponse {
  lockedWords: number[];
}

interface ExportNotebookParams {
  threadId: string;
  format: ExportFormat;
}

/**
 * Hook to fetch all notebook cells for a thread
 */
export function useNotebookCells(threadId: string | null | undefined) {
  return useQuery<FetchCellsResponse, ApiError>({
    queryKey: qkNotebookCells(threadId),
    enabled: typeof threadId === "string" && threadId.length > 0,
    queryFn: async () => {
      const res = await fetch(`/api/notebook/cells?threadId=${threadId}`);
      const json = await res.json();
      if (!res.ok) {
        throw {
          error: {
            code: json?.error?.code ?? `HTTP_${res.status}`,
            message: json?.error?.message ?? "Failed to fetch cells",
            details: json?.error?.details,
            upstream: json?.error?.upstream,
          },
        };
      }
      return json as FetchCellsResponse;
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to update a specific notebook cell
 */
export function useUpdateCell() {
  const queryClient = useQueryClient();

  return useMutation<UpdateCellResponse, ApiError, UpdateCellParams>({
    mutationFn: async ({ threadId, lineIndex, updates }) => {
      const res = await fetch(`/api/notebook/cells/${lineIndex}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, lineIndex, updates }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw {
          error: {
            code: json?.error?.code ?? `HTTP_${res.status}`,
            message: json?.error?.message ?? "Failed to update cell",
            details: json?.error?.details,
            upstream: json?.error?.upstream,
          },
        };
      }

      return json as UpdateCellResponse;
    },
    onSuccess: (data, variables) => {
      // Invalidate cells query to refresh
      queryClient.invalidateQueries({
        queryKey: qkNotebookCells(variables.threadId),
        exact: true,
      });
    },
  });
}

/**
 * Hook to generate prismatic variants (A/B/C) for a line
 */
export function useGeneratePrismatic() {
  return useMutation<GeneratePrismaticResponse, ApiError, GeneratePrismaticParams>({
    mutationFn: async ({ threadId, lineIndex, sourceText }) => {
      const res = await fetch('/api/notebook/prismatic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, lineIndex, sourceText }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw {
          error: {
            code: json?.error?.code ?? `HTTP_${res.status}`,
            message: json?.error?.message ?? "Failed to generate variants",
            details: json?.error?.details,
            upstream: json?.error?.upstream,
          },
        };
      }

      return json as GeneratePrismaticResponse;
    },
  });
}

/**
 * Hook to lock/unlock specific words in a cell
 */
export function useToggleLock() {
  const queryClient = useQueryClient();

  return useMutation<ToggleLockResponse, ApiError, ToggleLockParams>({
    mutationFn: async ({ threadId, lineIndex, wordPositions }) => {
      const res = await fetch('/api/notebook/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, lineIndex, wordPositions }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw {
          error: {
            code: json?.error?.code ?? `HTTP_${res.status}`,
            message: json?.error?.message ?? "Failed to update locks",
            details: json?.error?.details,
            upstream: json?.error?.upstream,
          },
        };
      }

      return json as ToggleLockResponse;
    },
    onSuccess: (data, variables) => {
      // Invalidate cells query to refresh
      queryClient.invalidateQueries({
        queryKey: qkNotebookCells(variables.threadId),
        exact: true,
      });
    },
  });
}

/**
 * Hook to export notebook in various formats
 */
export function useExportNotebook() {
  return useMutation<string, ApiError, ExportNotebookParams>({
    mutationFn: async ({ threadId, format }) => {
      const res = await fetch(`/api/notebook/export?threadId=${threadId}&format=${format}`);

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw {
          error: {
            code: json?.error?.code ?? `HTTP_${res.status}`,
            message: json?.error?.message ?? "Export failed",
            details: json?.error?.details,
            upstream: json?.error?.upstream,
          },
        };
      }

      // For successful responses, create a blob URL
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
  });
}
