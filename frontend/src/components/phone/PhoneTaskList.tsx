import { Fragment, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Check, ChevronRight } from "lucide-react";
import { STATUSES, isFinished } from "../../constants/status";
import type { Status, Task, TaskChanges } from "../../types";
import { useUiMode } from "../../hooks/useUiMode";
import { useNewIds } from "../../theme/moments";
import CompactTaskRow from "../CompactTaskRow";
import BottomSheet from "./BottomSheet";
import TaskCard from "./TaskCard";

interface PhoneTaskListProps {
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

/**
 * The task list on the phone layout (docs/SPEC.md 14): open tasks, which can
 * be reordered by their handle, then the finished ones in a folded section.
 */
export default function PhoneTaskList({
  tasks,
  loaded,
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
  const compact = useUiMode() === "compact";

  const open = tasks.filter((t) => !isFinished(t));
  const newIds = useNewIds(tasks.map((t) => t.id), loaded);
  const finished = tasks.filter(isFinished);
  // A task set to Done moves to the finished section, so its card is drawn
  // anew there: the list marks the moment (and the section's header) instead.
  const justFinished = useNewIds(finished.map((t) => t.id), loaded);
  const anyJustDone = finished.some((t) => justFinished.has(t.id) && t.status === "Done");

  // Positions are in the open list; the stored order is the whole list. Moving
  // onto another open task's place in the whole list keeps finished tasks put.
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const from = tasks.indexOf(open[result.source.index]);
    const to = tasks.indexOf(open[result.destination.index]);
    if (from !== to) onMove(from, to);
  };

  const card = (task: Task, drag?: Parameters<typeof TaskCard>[0]["drag"]) =>
    compact ? (
      <CompactTaskRow
        task={task}
        isNew={newIds.has(task.id)}
        justDone={justFinished.has(task.id) && task.status === "Done"}
        onToggle={() => onToggle(task.id)}
      />
    ) : (
    <TaskCard
      task={task}
      drag={drag}
      isEditing={editingId === task.id}
      isNew={newIds.has(task.id)}
      justDone={justFinished.has(task.id) && task.status === "Done"}
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

  const gap = compact ? "space-y-2" : "space-y-3";

  return (
    <>
      {compact ? (
        // No handle in compact mode, and a swipe on a row must scroll: no reordering here.
        <div className={gap}>
          {open.map((task) => (
            <Fragment key={task.id}>{card(task)}</Fragment>
          ))}
        </div>
      ) : (
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="phone-task-list">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className={gap}>
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
      )}

      {open.length === 0 && (
        <p className="py-8 text-center text-fg-muted">No open tasks. Tap + to add one.</p>
      )}

      {finished.length > 0 && (
        <section className="mt-5">
          <button
            onClick={() => setShowFinished((s) => !s)}
            aria-expanded={showFinished}
            data-just-done={anyJustDone || undefined}
            className="flex w-full items-center gap-1 py-2 text-sm font-semibold text-fg-soft"
          >
            <ChevronRight size={18} className={`transition-transform ${showFinished ? "rotate-90" : ""}`} />
            Finished ({finished.length})
          </button>
          {showFinished && (
            <div className={`mt-2 ${gap}`}>
              {finished.map((task) => (
                <div key={task.id}>{card(task)}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {statusFor && (
        <BottomSheet title="Status" onClose={() => setStatusFor(null)}>
          <p className="-mt-2 mb-3 truncate text-sm text-fg-muted">{statusFor.title}</p>
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
                className="flex h-12 w-full items-center justify-between px-4 text-left text-fg-strong"
              >
                {status}
                {status === statusFor.status && <Check size={18} className="text-accent" />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
