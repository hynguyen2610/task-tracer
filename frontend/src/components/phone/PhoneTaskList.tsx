import { useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Check, ChevronRight } from "lucide-react";
import { STATUSES, isFinished } from "../../constants/status";
import type { Status, Task, TaskChanges } from "../../types";
import BottomSheet from "./BottomSheet";
import TaskCard from "./TaskCard";

interface PhoneTaskListProps {
  tasks: Task[];
  onToggle: (id: number) => void;
  onPause: (id: number) => Promise<Task | undefined>;
  onDelete: (id: number) => void;
  onUpdate: (id: number, changes: TaskChanges) => Promise<void>;
  onStatusChange: (id: number, status: Status) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}

/**
 * The task list on the phone layout (docs/SPEC.md 14): open tasks, which can
 * be reordered by their handle, then the finished ones in a folded section.
 */
export default function PhoneTaskList({
  tasks,
  onToggle,
  onPause,
  onDelete,
  onUpdate,
  onStatusChange,
  onMove,
}: PhoneTaskListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusFor, setStatusFor] = useState<Task | null>(null);
  const [showFinished, setShowFinished] = useState(false);

  const open = tasks.filter((t) => !isFinished(t));
  const finished = tasks.filter(isFinished);

  // Positions are in the open list; the stored order is the whole list. Moving
  // onto another open task's place in the whole list keeps finished tasks put.
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const from = tasks.indexOf(open[result.source.index]);
    const to = tasks.indexOf(open[result.destination.index]);
    if (from !== to) onMove(from, to);
  };

  const card = (task: Task, drag?: Parameters<typeof TaskCard>[0]["drag"]) => (
    <TaskCard
      task={task}
      drag={drag}
      isEditing={editingId === task.id}
      onStartEdit={() => setEditingId(task.id)}
      onSave={async (changes) => {
        await onUpdate(task.id, changes);
        setEditingId(null);
      }}
      onToggle={() => onToggle(task.id)}
      onPause={() => onPause(task.id)}
      onPickStatus={() => setStatusFor(task)}
      onDelete={() => onDelete(task.id)}
    />
  );

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="phone-task-list">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
              {open.map((task, index) => (
                <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                  {(drag) => card(task, drag)}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {open.length === 0 && (
        <p className="py-8 text-center text-gray-500">No open tasks. Tap + to add one.</p>
      )}

      {finished.length > 0 && (
        <section className="mt-5">
          <button
            onClick={() => setShowFinished((s) => !s)}
            aria-expanded={showFinished}
            className="flex w-full items-center gap-1 py-2 text-sm font-semibold text-gray-600"
          >
            <ChevronRight size={18} className={`transition-transform ${showFinished ? "rotate-90" : ""}`} />
            Finished ({finished.length})
          </button>
          {showFinished && (
            <div className="mt-2 space-y-3">
              {finished.map((task) => (
                <div key={task.id}>{card(task)}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {statusFor && (
        <BottomSheet title="Status" onClose={() => setStatusFor(null)}>
          <p className="-mt-2 mb-3 truncate text-sm text-gray-500">{statusFor.title}</p>
          <div role="radiogroup" aria-label="Status" className="divide-y rounded-xl border">
            {STATUSES.map((status) => (
              <button
                key={status}
                role="radio"
                aria-checked={status === statusFor.status}
                onClick={() => {
                  onStatusChange(statusFor.id, status);
                  setStatusFor(null);
                }}
                className="flex h-12 w-full items-center justify-between px-4 text-left text-gray-800"
              >
                {status}
                {status === statusFor.status && <Check size={18} className="text-indigo-600" />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
