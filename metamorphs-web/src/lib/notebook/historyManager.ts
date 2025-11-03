/**
 * History Manager for Undo/Redo functionality
 *
 * Implements a command pattern for tracking state changes
 * with a maximum history limit.
 */

import { NotebookCell } from "@/types/notebook";

export interface HistoryState {
  droppedCells: NotebookCell[];
  timestamp: number;
}

export interface HistoryManager {
  past: HistoryState[];
  present: HistoryState;
  future: HistoryState[];
}

const MAX_HISTORY_SIZE = 20;

/**
 * Create initial history state
 */
export function createInitialHistory(
  initialCells: NotebookCell[]
): HistoryManager {
  return {
    past: [],
    present: {
      droppedCells: initialCells,
      timestamp: Date.now(),
    },
    future: [],
  };
}

/**
 * Add a new state to history (pushes to undo stack)
 */
export function addToHistory(
  history: HistoryManager,
  newState: NotebookCell[]
): HistoryManager {
  const newPresent: HistoryState = {
    droppedCells: newState,
    timestamp: Date.now(),
  };

  // Add current present to past
  const newPast = [...history.past, history.present];

  // Limit history size (remove oldest if exceeding limit)
  if (newPast.length > MAX_HISTORY_SIZE) {
    newPast.shift();
  }

  return {
    past: newPast,
    present: newPresent,
    future: [], // Clear future when new action is performed
  };
}

/**
 * Undo - move back one step in history
 */
export function undo(history: HistoryManager): HistoryManager | null {
  if (history.past.length === 0) {
    return null; // Nothing to undo
  }

  const newPast = [...history.past];
  const newPresent = newPast.pop()!;
  const newFuture = [history.present, ...history.future];

  return {
    past: newPast,
    present: newPresent,
    future: newFuture,
  };
}

/**
 * Redo - move forward one step in history
 */
export function redo(history: HistoryManager): HistoryManager | null {
  if (history.future.length === 0) {
    return null; // Nothing to redo
  }

  const newFuture = [...history.future];
  const newPresent = newFuture.shift()!;
  const newPast = [...history.past, history.present];

  return {
    past: newPast,
    present: newPresent,
    future: newFuture,
  };
}

/**
 * Check if undo is available
 */
export function canUndo(history: HistoryManager): boolean {
  return history.past.length > 0;
}

/**
 * Check if redo is available
 */
export function canRedo(history: HistoryManager): boolean {
  return history.future.length > 0;
}

/**
 * Get history info for debugging
 */
export function getHistoryInfo(history: HistoryManager) {
  return {
    pastStates: history.past.length,
    futureStates: history.future.length,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };
}
