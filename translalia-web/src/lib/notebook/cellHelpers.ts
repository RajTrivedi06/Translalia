/**
 * Helper functions for managing notebook cells and drag-and-drop data
 */

import { DragData } from "@/types/drag";
import { NotebookCell } from "@/types/notebook";

/**
 * Convert drag data from workshop to a notebook cell
 */
export function createCellFromDragData(dragData: DragData): NotebookCell {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    lineIndex: dragData.sourceLineNumber,
    source: {
      text: dragData.originalWord,
      language: "source", // TODO: Get actual source language
      dialect: undefined,
    },
    translation: {
      text: dragData.text,
      status: "draft",
      lockedWords: [],
    },
    notes: [],
    footnotes: [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      wordCount: dragData.text.split(/\s+/).length,
    },
  };
}

/**
 * Create a cell from multiple drag data items (for multi-word translations)
 */
export function createCellFromMultipleDragData(
  dragDataItems: DragData[]
): NotebookCell {
  const now = new Date().toISOString();
  const firstItem = dragDataItems[0];

  return {
    id: crypto.randomUUID(),
    lineIndex: firstItem.sourceLineNumber,
    source: {
      text: dragDataItems.map((d) => d.originalWord).join(" "),
      language: "source",
      dialect: undefined,
    },
    translation: {
      text: dragDataItems.map((d) => d.text).join(" "),
      status: "draft",
      lockedWords: [],
    },
    notes: [],
    footnotes: [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      wordCount: dragDataItems.length,
    },
  };
}

/**
 * Merge a new word into an existing cell
 */
export function mergeDragDataIntoCell(
  cell: NotebookCell,
  dragData: DragData
): NotebookCell {
  return {
    ...cell,
    source: {
      ...cell.source,
      text: `${cell.source.text} ${dragData.originalWord}`,
    },
    translation: {
      ...cell.translation,
      text: `${cell.translation.text} ${dragData.text}`,
    },
    metadata: {
      ...cell.metadata,
      updatedAt: new Date().toISOString(),
      wordCount: cell.metadata.wordCount + 1,
    },
  };
}
