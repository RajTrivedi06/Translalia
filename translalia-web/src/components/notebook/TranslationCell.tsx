"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { GripVertical, X, Edit2, Check, Lock, Unlock } from "lucide-react";
import { DragData } from "@/types/drag";

export interface TranslationCellData {
  id: string;
  words: DragData[];
  isEditing: boolean;
  isLocked: boolean;
  isModified?: boolean; // Track if cell has been edited
  customText?: string;
  translationText?: string;
  sourceLineNumber?: number;
}

export type CellMode = "arrange" | "edit";

interface TranslationCellProps {
  cell: TranslationCellData;
  mode: CellMode; // Current notebook mode
  onEdit: (cellId: string) => void;
  onSave: (cellId: string, text: string) => void;
  onCancel: (cellId: string) => void;
  onRemove: (cellId: string) => void;
  onToggleLock: (cellId: string) => void;
}

export function TranslationCell({
  cell,
  mode,
  onEdit,
  onSave,
  onCancel,
  onRemove,
  onToggleLock,
}: TranslationCellProps) {
  const [editText, setEditText] = React.useState(
    cell.customText || cell.words.map((w) => w.text).join(" ")
  );

  const isArrangeMode = mode === "arrange";
  const isEditMode = mode === "edit";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: cell.id,
    disabled: isEditMode, // Disable dragging in edit mode
    transition: {
      duration: 200,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const chipText =
    cell.customText?.trim() ||
    cell.translationText?.trim() ||
    cell.words
      .map((w) => w.text)
      .filter(Boolean)
      .join(" ");
  const partOfSpeechSummary = cell.words.length
    ? Array.from(new Set(cell.words.map((w) => w.partOfSpeech))).join(", ")
    : "";

  React.useEffect(() => {
    if (cell.isEditing) {
      setEditText(cell.customText || cell.words.map((w) => w.text).join(" "));
    }
  }, [cell.isEditing, cell.customText, cell.words]);

  const handleSave = () => {
    onSave(cell.id, editText);
  };

  const handleCancel = () => {
    setEditText(cell.customText || cell.words.map((w) => w.text).join(" "));
    onCancel(cell.id);
  };

  if (isArrangeMode && !cell.isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all duration-150 bg-white shadow-sm",
          isDragging && "opacity-60 shadow-lg scale-105 z-50",
          cell.isLocked && "border-yellow-400",
          cell.isModified && "border-green-500",
          chipText ? "text-gray-900" : "text-gray-400",
          "hover:border-blue-300"
        )}
        onDoubleClick={() => onEdit(cell.id)}
        {...attributes}
        {...listeners}
      >
        <span className="text-sm font-medium truncate max-w-[180px]">
          {chipText || "…"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(cell.id);
            }}
            title="Edit word"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          {partOfSpeechSummary && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
              {partOfSpeechSummary.toUpperCase()}
            </Badge>
          )}
          {!cell.isLocked && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(cell.id);
              }}
              title="Remove"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        // In edit mode, clicking the cell starts editing
        if (isEditMode && !cell.isEditing) {
          onEdit(cell.id);
        }
      }}
      className={cn(isEditMode && !cell.isEditing && "cursor-pointer")}
    >
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "mb-3 transition-all duration-200",
          isDragging && "opacity-50 shadow-2xl scale-105 z-50",
          cell.isLocked && "ring-2 ring-yellow-400",
          cell.isModified && "ring-2 ring-green-400",
          isEditMode && !cell.isEditing && "hover:shadow-md"
        )}
        {...attributes}
        {...(isArrangeMode ? listeners : {})}
      >
        {/* Cell Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            {/* Drag indicator icon */}
            {isArrangeMode && (
              <span className="p-1 rounded bg-gray-100 text-gray-400">
                <GripVertical className="w-3 h-3" />
              </span>
            )}

            {/* Modified indicator */}
            {cell.isModified && (
              <span className="text-xs text-green-600 font-medium">●</span>
            )}

            {/* Source Info */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>
                Line{" "}
                {cell.sourceLineNumber ??
                  cell.words[0]?.sourceLineNumber ??
                  "?"}
              </span>
            </div>

            {/* POS Badges */}
            <div className="flex gap-1">
              {Array.from(
                new Set(cell.words.map((w) => w.partOfSpeech).filter(Boolean))
              ).map(
                (pos) =>
                  pos && (
                    <Badge
                      key={pos}
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-4"
                    >
                      {pos.toUpperCase()}
                    </Badge>
                  )
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* When editing: Show only Save and Cancel */}
            {cell.isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                  onClick={handleSave}
                  title="Save"
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                  onClick={handleCancel}
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <>
                {/* Lock/Unlock - only when not editing */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => onToggleLock(cell.id)}
                  title={cell.isLocked ? "Unlock cell" : "Lock cell"}
                >
                  {cell.isLocked ? (
                    <Lock className="w-3 h-3 text-yellow-600" />
                  ) : (
                    <Unlock className="w-3 h-3 text-gray-400" />
                  )}
                </Button>

                {/* Edit button - only when not editing and in arrange mode */}
                {isArrangeMode && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(cell.id);
                    }}
                    title="Edit translation"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                )}

                {/* Remove - only when not editing and not locked */}
                {!cell.isLocked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                    onClick={() => onRemove(cell.id)}
                    title="Remove cell"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Cell Body */}
        <div className="p-4" onClick={(e) => e.stopPropagation()}>
          {cell.isEditing ? (
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[60px] resize-none"
              placeholder="Edit your translation..."
              autoFocus
              onKeyDown={(e) => {
                // Cancel on Escape
                if (e.key === "Escape") {
                  e.preventDefault();
                  handleCancel();
                }
              }}
            />
          ) : (
            <div className="space-y-2">
              {/* Translation Text */}
              <p className="text-base font-medium leading-relaxed">
                {cell.customText || cell.words.map((w) => w.text).join(" ")}
              </p>

              {/* Original Words Reference */}
              <div className="text-xs text-gray-500 flex flex-wrap gap-2 pt-2 border-t">
                <span className="font-medium">From:</span>
                {cell.words.map((w, idx) => (
                  <span key={idx} className="italic">
                    {w.originalWord}
                    {idx < cell.words.length - 1 ? "," : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
