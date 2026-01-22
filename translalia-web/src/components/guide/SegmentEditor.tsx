"use client";

import * as React from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { X, Plus, Trash2, Sparkles, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  detectSmartBreakpoints,
  breakpointsToSegments,
} from "@/lib/poem/smartStanzaDetection";

export interface CustomSegmentation {
  lineToSegment: Map<number, number>; // Map of line index -> segment number (1-indexed)
  totalSegments: number;
}

interface SegmentEditorProps {
  poemLines: string[]; // Array of non-empty lines
  initialSegmentation?: CustomSegmentation;
  onConfirm: (segmentation: CustomSegmentation) => void;
  onCancel: () => void;
}

export function SegmentEditor({
  poemLines,
  initialSegmentation,
  onConfirm,
  onCancel,
}: SegmentEditorProps) {
  // Convert poem lines back to text for smart detection
  const poemText = poemLines.join("\n");

  // Initialize segmentation from smart detection or provided initial
  const [lineToSegment, setLineToSegment] = React.useState<Map<number, number>>(
    () => {
      if (initialSegmentation) {
        return new Map(initialSegmentation.lineToSegment);
      }

      // Run smart detection
      const breakpoints = detectSmartBreakpoints(poemText);
      return breakpointsToSegments(poemText, breakpoints);
    }
  );

  // Drag and drop state
  const [activeLineIndex, setActiveLineIndex] = React.useState<number | null>(
    null
  );

  // User-added empty segments (survive auto-remove until they have lines or are removed)
  const [emptySegmentNumbers, setEmptySegmentNumbers] = React.useState<
    Set<number>
  >(() => new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Calculate total segments (from lines + user-added empty segments)
  const totalSegments = React.useMemo(() => {
    const fromLines = new Set(lineToSegment.values());
    const combined = new Set([...fromLines, ...emptySegmentNumbers]);
    return combined.size;
  }, [lineToSegment, emptySegmentNumbers]);

  // Move a line to a different segment
  const moveLineToSegment = React.useCallback(
    (lineIndex: number, targetSegment: number) => {
      setLineToSegment((prev) => {
        const next = new Map(prev);
        next.set(lineIndex, targetSegment);
        return next;
      });
      setEmptySegmentNumbers((prev) => {
        if (!prev.has(targetSegment)) return prev;
        const next = new Set(prev);
        next.delete(targetSegment);
        return next;
      });
    },
    []
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const lineIndex = parseInt(event.active.id as string, 10);
    setActiveLineIndex(lineIndex);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLineIndex(null);
    const { active, over } = event;

    if (!over) return;

    const lineIndex = parseInt(active.id as string, 10);
    const targetSegmentId = over.id as string;

    // Check if dropping on a segment
    if (targetSegmentId.startsWith("segment-")) {
      const targetSegment = parseInt(
        targetSegmentId.replace("segment-", ""),
        10
      );
      moveLineToSegment(lineIndex, targetSegment);
    }
  };

  // Add a new segment (empty drop zone; user assigns lines via drag)
  const addSegment = React.useCallback(() => {
    const fromLines = new Set(lineToSegment.values());
    const all = new Set<number>([...fromLines, ...emptySegmentNumbers]);
    const nextNum = all.size > 0 ? Math.max(...all) + 1 : 1;
    setEmptySegmentNumbers((e) => new Set([...e, nextNum]));
  }, [lineToSegment, emptySegmentNumbers]);

  // Remove a segment (reassign its lines to segment 1, drop if empty)
  const removeSegment = React.useCallback(
    (segmentNumber: number) => {
      if (totalSegments <= 1) return;

      setLineToSegment((prev) => {
        const next = new Map(prev);
        next.forEach((seg, lineIdx) => {
          if (seg === segmentNumber) next.set(lineIdx, 1);
          else if (seg > segmentNumber) next.set(lineIdx, seg - 1);
        });
        return next;
      });
      setEmptySegmentNumbers((prev) => {
        if (!prev.has(segmentNumber)) {
          // Renumber empty segments after the removed one
          return new Set(
            [...prev].map((n) => (n > segmentNumber ? n - 1 : n)).filter((n) => n !== segmentNumber)
          );
        }
        const next = new Set(prev);
        next.delete(segmentNumber);
        return new Set([...next].map((n) => (n > segmentNumber ? n - 1 : n)));
      });
    },
    [totalSegments]
  );

  // Auto-remove empty segments (skip user-added empty segments)
  React.useEffect(() => {
    const segmentCounts = new Map<number, number>();
    lineToSegment.forEach((seg) => {
      segmentCounts.set(seg, (segmentCounts.get(seg) || 0) + 1);
    });
    const allSegs = [
      ...lineToSegment.values(),
      ...emptySegmentNumbers,
    ];
    const maxSeg = allSegs.length > 0 ? Math.max(...allSegs) : 0;
    const emptySegments: number[] = [];
    for (let i = 1; i <= maxSeg; i++) {
      if (emptySegmentNumbers.has(i)) continue;
      if (!segmentCounts.has(i) || segmentCounts.get(i) === 0) {
        emptySegments.push(i);
      }
    }
    if (emptySegments.length === 0) return;

    setLineToSegment((prev) => {
      const next = new Map(prev);
      const sortedEmpty = [...emptySegments].sort((a, b) => b - a);
      sortedEmpty.forEach((emptySeg) => {
        next.forEach((seg, lineIdx) => {
          if (seg > emptySeg) next.set(lineIdx, seg - 1);
        });
      });
      return next;
    });
    setEmptySegmentNumbers((prev) => {
      let next = new Set(prev);
      const sortedEmpty = [...emptySegments].sort((a, b) => b - a);
      sortedEmpty.forEach((emptySeg) => {
        next = new Set([...next].map((n) => (n > emptySeg ? n - 1 : n)).filter((n) => n !== emptySeg));
      });
      return next;
    });
  }, [lineToSegment, emptySegmentNumbers]);

  // Re-run smart detection
  const rerunSmartDetection = React.useCallback(() => {
    if (!poemText || poemText.trim().length === 0) {
      console.warn("[SegmentEditor] Cannot run smart detection: poem text is empty");
      return;
    }
    try {
      const breakpoints = detectSmartBreakpoints(poemText);
      const newSegmentation = breakpointsToSegments(poemText, breakpoints);
      setLineToSegment(newSegmentation);
      setEmptySegmentNumbers(new Set());
    } catch (error) {
      console.error("[SegmentEditor] Error running smart detection:", error);
    }
  }, [poemText]);

  // Handle confirm
  const handleConfirm = React.useCallback(() => {
    onConfirm({
      lineToSegment,
      totalSegments,
    });
  }, [lineToSegment, totalSegments, onConfirm]);

  // Group lines by segment for display (include user-added empty segments)
  const segmentsData = React.useMemo(() => {
    const segments = new Map<
      number,
      Array<{ lineIndex: number; lineText: string }>
    >();

    poemLines.forEach((line, idx) => {
      const segmentNum = lineToSegment.get(idx) || 1;
      if (!segments.has(segmentNum)) {
        segments.set(segmentNum, []);
      }
      segments.get(segmentNum)!.push({ lineIndex: idx, lineText: line });
    });

    emptySegmentNumbers.forEach((num) => {
      if (!segments.has(num)) segments.set(num, []);
    });

    return Array.from(segments.entries())
      .sort(([a], [b]) => a - b)
      .map(([segmentNum, lines]) => ({
        segmentNumber: segmentNum,
        lines: [...lines].sort((a, b) => a.lineIndex - b.lineIndex),
      }));
  }, [poemLines, lineToSegment, emptySegmentNumbers]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Customize Segments
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Organize your poem into segments. Each segment will be
                translated separately.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full p-2 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Actions */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => rerunSmartDetection()}
                  disabled={!poemText || poemText.trim().length === 0}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Re-run Smart Detection
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addSegment()}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Segment
                </Button>
              </div>
              <Badge variant="secondary" className="text-sm">
                {totalSegments} segment{totalSegments !== 1 ? "s" : ""}
              </Badge>
            </div>

            {/* Segments */}
            <div className="space-y-4">
              {segmentsData.map(({ segmentNumber, lines }) => (
                <SegmentDropZone
                  key={segmentNumber}
                  segmentNumber={segmentNumber}
                  lines={lines}
                  totalSegments={totalSegments}
                  moveLineToSegment={moveLineToSegment}
                  removeSegment={removeSegment}
                  activeLineIndex={activeLineIndex}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Confirm Segments</Button>
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeLineIndex !== null ? (
          <div className="bg-white border-2 border-blue-500 rounded-lg shadow-lg p-3 flex items-center gap-3 min-w-[300px]">
            <GripVertical className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-400 font-mono">
              {activeLineIndex + 1}
            </span>
            <span className="flex-1 text-sm text-slate-700">
              {poemLines[activeLineIndex]}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Draggable Line Component
function DraggableLine({
  lineIndex,
  lineText,
  segmentNumber,
  totalSegments,
  moveLineToSegment,
  isDragging,
}: {
  lineIndex: number;
  lineText: string;
  segmentNumber: number;
  totalSegments: number;
  moveLineToSegment: (lineIndex: number, targetSegment: number) => void;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: String(lineIndex),
    data: { lineIndex, lineText },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-2 bg-white rounded border transition-all",
        "hover:border-blue-300 hover:shadow-sm",
        isDragging && "opacity-50",
        !isDragging && "border-slate-200"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <span className="text-xs text-slate-400 font-mono w-8">
        {lineIndex + 1}
      </span>
      <span className="flex-1 text-sm text-slate-700">{lineText}</span>
      <select
        value={segmentNumber}
        onChange={(e) =>
          moveLineToSegment(lineIndex, parseInt(e.target.value, 10))
        }
        className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {Array.from({ length: totalSegments }, (_, i) => i + 1).map(
          (segNum) => (
            <option key={segNum} value={segNum}>
              Segment {segNum}
            </option>
          )
        )}
      </select>
    </div>
  );
}

// Droppable Segment Component
function SegmentDropZone({
  segmentNumber,
  lines,
  totalSegments,
  moveLineToSegment,
  removeSegment,
  activeLineIndex,
}: {
  segmentNumber: number;
  lines: Array<{ lineIndex: number; lineText: string }>;
  totalSegments: number;
  moveLineToSegment: (lineIndex: number, targetSegment: number) => void;
  removeSegment: (segmentNumber: number) => void;
  activeLineIndex: number | null;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `segment-${segmentNumber}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border rounded-lg p-4 transition-colors",
        isOver
          ? "border-blue-400 bg-blue-50/50"
          : "border-slate-200 bg-slate-50"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900">
            Segment {segmentNumber}
          </h3>
          <Badge variant="outline" className="text-xs">
            {lines.length} line{lines.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        {totalSegments > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeSegment(segmentNumber)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remove
          </Button>
        )}
      </div>

      {/* Lines in this segment */}
      <div className="space-y-2 mb-3 min-h-[40px]">
        {lines.length === 0 ? (
          <div className="text-center py-4 text-sm text-slate-400 border-2 border-dashed border-slate-300 rounded">
            Drop lines here
          </div>
        ) : (
          lines.map(({ lineIndex, lineText }) => (
            <DraggableLine
              key={lineIndex}
              lineIndex={lineIndex}
              lineText={lineText}
              segmentNumber={segmentNumber}
              totalSegments={totalSegments}
              moveLineToSegment={moveLineToSegment}
              isDragging={activeLineIndex === lineIndex}
            />
          ))
        )}
      </div>
    </div>
  );
}
