"use client";

import * as React from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";

interface TestItem {
  id: string;
  content: string;
}

function SortableTestItem({ item }: { item: TestItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-4 mb-2 cursor-move ${isDragging ? "opacity-50" : ""}`}
      {...attributes}
      {...listeners}
    >
      <p className="text-sm font-medium">{item.content}</p>
    </Card>
  );
}

/**
 * DnDTestComponent - A simple component to test drag-and-drop functionality
 *
 * This component creates a list of draggable items to verify that:
 * 1. @dnd-kit packages are correctly installed
 * 2. DndContext is properly configured
 * 3. Sortable items can be dragged and reordered
 * 4. DragOverlay provides visual feedback during drag
 *
 * Usage:
 * Import and render this component in any page to test DnD functionality:
 * ```tsx
 * import { DnDTestComponent } from "@/components/notebook/DnDTestComponent";
 *
 * export default function TestPage() {
 *   return <DnDTestComponent />;
 * }
 * ```
 */
export function DnDTestComponent() {
  const [items, setItems] = React.useState<TestItem[]>([
    { id: "1", content: "Drag me! Item 1" },
    { id: "2", content: "Drag me! Item 2" },
    { id: "3", content: "Drag me! Item 3" },
    { id: "4", content: "Drag me! Item 4" },
  ]);

  const [activeItem, setActiveItem] = React.useState<TestItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = items.find((i) => i.id === active.id);
    if (item) {
      setActiveItem(item);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (over && active.id !== over.id) {
      setItems((prevItems) => {
        const oldIndex = prevItems.findIndex((i) => i.id === active.id);
        const newIndex = prevItems.findIndex((i) => i.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newItems = [...prevItems];
          const [removed] = newItems.splice(oldIndex, 1);
          newItems.splice(newIndex, 0, removed);
          return newItems;
        }

        return prevItems;
      });
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">DnD Test Component</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Try dragging the items below to reorder them.
      </p>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableTestItem key={item.id} item={item} />
          ))}
        </SortableContext>

        <DragOverlay>
          {activeItem ? (
            <Card className="p-4 opacity-75 shadow-lg">
              <p className="text-sm font-medium">{activeItem.content}</p>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="mt-6 p-4 bg-muted rounded-md">
        <p className="text-xs font-mono">
          Current order: {items.map((i) => i.id).join(", ")}
        </p>
      </div>
    </div>
  );
}
