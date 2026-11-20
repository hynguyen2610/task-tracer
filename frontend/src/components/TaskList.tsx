import { useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import type { Status, Task, TaskChanges } from "../types";
import { useUiMode } from "../hooks/useUiMode";
import { useNewIds } from "../theme/moments";
import CompactTaskRow from "./CompactTaskRow";
import TaskItem from "./TaskItem";

interface TaskListProps {
  tasks: Task[];
  /** Whether the list has been read yet (see useTasks). */
  loaded: boolean;
  onToggle: (id: number) => void;
  onPause: (id: number) => Promise<Task | undefined>;
  onDelete: (id: number) => void;
  onUpdate: (id: number, changes: TaskChanges) => Promise<void>;
  onStatusChange: (id: number, status: Status) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}

export default function TaskList({
  tasks,
  loaded,
  onToggle,
  onPause,
  onDelete,
  onUpdate,
  onStatusChange,
  onMove,
}: TaskListProps) {
  // Only one task can be edited at a time.
  const [editingId, setEditingId] = useState<number | null>(null);
  const newIds = useNewIds(tasks.map((t) => t.id), loaded);
  const compact = useUiMode() === "compact";

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    onMove(result.source.index, result.destination.index);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="task-list">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={compact ? "space-y-2" : "space-y-4"}
          >
            {tasks.map((task, index) =>
              compact ? (
                <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                  {(drag) => (
                    <CompactTaskRow
                      task={task}
                      drag={drag}
                      isNew={newIds.has(task.id)}
                      onToggle={() => onToggle(task.id)}
                    />
                  )}
                </Draggable>
              ) : (
              <TaskItem
                key={task.id}
                task={task}
                index={index}
                isEditing={editingId === task.id}
                isNew={newIds.has(task.id)}
                onStartEdit={() => setEditingId(task.id)}
                onSave={async (changes) => {
                  await onUpdate(task.id, changes);
                  setEditingId(null);
                }}
                onToggle={() => onToggle(task.id)}
                onPause={() => onPause(task.id)}
                onStatusChange={(status) => onStatusChange(task.id, status)}
                onDelete={() => onDelete(task.id)}
              />
              )
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
