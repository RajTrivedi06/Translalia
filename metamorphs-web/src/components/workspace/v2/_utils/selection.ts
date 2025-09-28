// src/components/workspace/v2/_utils/selection.ts

export type SelectionState = {
  selectedLineIds: Set<string>;
  lastClickedLineId?: string;
};

export type SelectionAction =
  | { type: "SELECT_SINGLE"; lineId: string }
  | { type: "SELECT_RANGE"; fromLineId: string; toLineId: string; allLineIds: string[] }
  | { type: "TOGGLE_SINGLE"; lineId: string }
  | { type: "SELECT_ALL"; allLineIds: string[] }
  | { type: "CLEAR_ALL" };

export function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case "SELECT_SINGLE":
      return {
        selectedLineIds: new Set([action.lineId]),
        lastClickedLineId: action.lineId,
      };

    case "SELECT_RANGE": {
      const { fromLineId, toLineId, allLineIds } = action;
      const fromIdx = allLineIds.indexOf(fromLineId);
      const toIdx = allLineIds.indexOf(toLineId);

      if (fromIdx === -1 || toIdx === -1) return state;

      const start = Math.min(fromIdx, toIdx);
      const end = Math.max(fromIdx, toIdx);
      const rangeIds = allLineIds.slice(start, end + 1);

      return {
        selectedLineIds: new Set([...state.selectedLineIds, ...rangeIds]),
        lastClickedLineId: toLineId,
      };
    }

    case "TOGGLE_SINGLE": {
      const newSelected = new Set(state.selectedLineIds);
      if (newSelected.has(action.lineId)) {
        newSelected.delete(action.lineId);
      } else {
        newSelected.add(action.lineId);
      }

      return {
        selectedLineIds: newSelected,
        lastClickedLineId: action.lineId,
      };
    }

    case "SELECT_ALL":
      return {
        selectedLineIds: new Set(action.allLineIds),
        lastClickedLineId: state.lastClickedLineId,
      };

    case "CLEAR_ALL":
      return {
        selectedLineIds: new Set(),
        lastClickedLineId: undefined,
      };

    default:
      return state;
  }
}

export function getSelectionSummary(selectedLineIds: Set<string>, totalLines: number) {
  const count = selectedLineIds.size;
  if (count === 0) return "No lines selected";
  if (count === 1) return "1 line selected";
  if (count === totalLines) return "All lines selected";
  return `${count} lines selected`;
}