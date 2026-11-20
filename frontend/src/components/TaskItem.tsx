import { Draggable } from "@hello-pangea/dnd";
import { Check, Edit2, Trash2 } from "lucide-react";
import { PRIORITY_COLORS } from "../constants/priority";
import { STATUS_COLORS, STATUSES, canStart } from "../constants/status";
import type { Status, Task, TaskChanges } from "../types";
import { formatDuration } from "../utils/time";
import { formatReportDate } from "../report/dailyReport";
import { useTimeFormat } from "../hooks/useTimeFormat";
import { useJustBecame } from "../theme/moments";
import { useTaskEditing } from "../hooks/useTaskEditing";
import DueProgressBar from "./DueProgressBar";
import OptionSelect from "./OptionSelect";
import PlayPauseButton from "./PlayPauseButton";
import TaskEditForm from "./TaskEditForm";

interface TaskItemProps {
  task: Task;
  index: number;
  isEditing: boolean;
  /** Just added: the theme may animate its arrival (docs/SPEC.md 15). */
  isNew?: boolean;
  onStartEdit: () => void;
  onSave: (changes: TaskChanges) => Promise<void>;
  onToggle: () => void;
  onPause: () => Promise<Task | undefined>;
  onStatusChange: (status: Status) => void;
  onDelete: () => void;
}

export default function TaskItem({
  task,
  index,
  isEditing,
  isNew = false,
  onStartEdit,
  onSave,
  onToggle,
  onPause,
  onStatusChange,
  onDelete,
}: TaskItemProps) {
  const { draft, setDraft, startEditing, save } = useTaskEditing(task, onPause, onStartEdit, onSave);
  const timeFormat = useTimeFormat();
  const justDone = useJustBecame(task.status === "Done");

  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          data-testid="task"
          data-status={task.status}
          data-new={isNew || undefined}
          data-just-done={justDone || undefined}
          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 rounded-xl shadow-sm ${
            STATUS_COLORS[task.status] ?? PRIORITY_COLORS[task.priority]
          } ${task.isRunning ? "glow border-primary" : ""}`}
        >
          {/* On a phone the buttons go on a line of their own, so the title gets the width. */}
          <div className="flex items-start sm:items-center flex-1 min-w-0">
            <div className="flex-shrink-0 mr-3 sm:mr-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-accent text-on-color flex items-center justify-center font-semibold">
                {index + 1}
              </div>
            </div>

            {isEditing ? (
              <TaskEditForm draft={draft} onChange={setDraft} onSave={save} />
            ) : (
              <div className="min-w-0 flex-1">
                {/* Wraps only when the title is longer than the row. */}
                <p className="task-title font-medium text-fg-strong break-words">
                  <span className="task-title-text">{task.title}</span>
                </p>
                {/* Stacked on narrow screens, one line on wider ones. */}
                <div className="md:flex md:flex-wrap md:items-center md:gap-x-6">
                  <p className="text-fg-soft text-sm">
                    <span className="font-medium">Consumed Time:</span>{" "}
                    <span className="task-time">{formatDuration(task.totalSeconds, timeFormat)}</span>
                  </p>
                  <p className="text-fg-soft text-sm">
                    <span className="font-medium">Priority:</span> {task.priority}
                  </p>
                  {task.etaHours !== null && (
                    <p className="text-fg-soft text-sm">
                      <span className="font-medium">ETA:</span> {task.etaHours} h
                    </p>
                  )}
                  {task.startedAt && (
                    <p className="text-fg-soft text-sm">
                      <span className="font-medium">Started:</span>{" "}
                      {formatReportDate(new Date(task.startedAt))}
                    </p>
                  )}
                  {task.dueAt !== null && (
                    <p className="text-fg-soft text-sm">
                      <span className="font-medium">Due:</span> {formatReportDate(new Date(task.dueAt))}
                    </p>
                  )}
                  <label className="block text-fg-soft text-sm">
                    <span className="font-medium">Status:</span>{" "}
                    <OptionSelect
                      value={task.status}
                      options={STATUSES}
                      onChange={onStatusChange}
                      className="border rounded px-1 py-0.5 bg-surface/70 text-fg"
                    />
                    {task.statusNote && (
                      <span className="ml-2 italic">({task.statusNote})</span>
                    )}
                  </label>
                </div>
                <DueProgressBar task={task} className="mt-2 max-w-md" />
              </div>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 self-end sm:self-auto">
            <PlayPauseButton
              isRunning={task.isRunning}
              onClick={onToggle}
              disabled={!task.isRunning && !canStart(task.status)}
              title={
                canStart(task.status)
                  ? undefined
                  : `${task.status} tasks can't be started`
              }
            />

            {isEditing ? (
              <button
                onClick={save}
                aria-label="Save task"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-on-color hover:bg-primary-hover"
              >
                <Check />
              </button>
            ) : (
              <button
                onClick={startEditing}
                aria-label="Edit task"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-edit text-on-color hover:bg-edit-hover"
              >
                <Edit2 />
              </button>
            )}

            <button
              onClick={onDelete}
              aria-label="Delete task"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-neutral text-on-color hover:bg-neutral-hover"
            >
              <Trash2 />
            </button>
          </div>
        </div>
      )}
    </Draggable>
  );
}
