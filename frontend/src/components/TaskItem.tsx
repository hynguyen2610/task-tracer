import { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Check, Edit2, Trash2 } from "lucide-react";
import { DEFAULT_PRIORITY, PRIORITY_COLORS } from "../constants/priority";
import {
  DEFAULT_STATUS,
  STATUS_COLORS,
  STATUSES,
  canStart,
} from "../constants/status";
import type { Status, Task, TaskChanges } from "../types";
import { formatDuration } from "../utils/time";
import { fromDateInput, toDateInput } from "../utils/date";
import { formatReportDate } from "../report/dailyReport";
import { useTimeFormat } from "../hooks/useTimeFormat";
import OptionSelect from "./OptionSelect";
import PlayPauseButton from "./PlayPauseButton";
import TaskEditForm, { type TaskDraft } from "./TaskEditForm";

interface TaskItemProps {
  task: Task;
  index: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (changes: TaskChanges) => Promise<void>;
  onToggle: () => void;
  onPause: () => Promise<Task | undefined>;
  onStatusChange: (status: Status) => void;
  onDelete: () => void;
}

const emptyDraft: TaskDraft = {
  title: "",
  totalSeconds: 0,
  timeEdited: false,
  priority: DEFAULT_PRIORITY,
  status: DEFAULT_STATUS,
  statusNote: "",
  startDate: "",
  startDateEdited: false,
};

export default function TaskItem({
  task,
  index,
  isEditing,
  onStartEdit,
  onSave,
  onToggle,
  onPause,
  onStatusChange,
  onDelete,
}: TaskItemProps) {
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const timeFormat = useTimeFormat();

  const startEditing = async () => {
    // Pause a running task first, so the form shows its up-to-date time and
    // no time is counted while it is being edited.
    const current = task.isRunning ? ((await onPause()) ?? task) : task;
    setDraft({
      title: current.title,
      totalSeconds: current.totalSeconds,
      timeEdited: false,
      priority: current.priority,
      status: current.status,
      statusNote: current.statusNote ?? "",
      startDate: toDateInput(current.startedAt ? new Date(current.startedAt) : new Date()),
      startDateEdited: false,
    });
    onStartEdit();
  };

  const save = async () => {
    await onSave({
      title: draft.title,
      // Only send the time if it was changed, so opening and saving the form
      // doesn't round away seconds.
      totalSeconds: draft.timeEdited ? draft.totalSeconds : undefined,
      priority: draft.priority,
      status: draft.status,
      statusNote: draft.statusNote,
      // Likewise only a picked date is sent: an unstarted task keeps no start
      // date (today is just the picker's default) until it really starts.
      startedAt: draft.startDateEdited
        ? (fromDateInput(draft.startDate) ?? undefined)
        : undefined,
    });
    setDraft(emptyDraft);
  };

  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          data-testid="task"
          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 rounded-xl shadow-sm ${
            STATUS_COLORS[task.status] ?? PRIORITY_COLORS[task.priority]
          } ${task.isRunning ? "glow border-blue-500" : ""}`}
        >
          {/* On a phone the buttons go on a line of their own, so the title gets the width. */}
          <div className="flex items-start sm:items-center flex-1 min-w-0">
            <div className="flex-shrink-0 mr-3 sm:mr-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold">
                {index + 1}
              </div>
            </div>

            {isEditing ? (
              <TaskEditForm draft={draft} onChange={setDraft} onSave={save} />
            ) : (
              <div className="min-w-0">
                {/* Wraps only when the title is longer than the row. */}
                <p className="font-medium text-gray-800 break-words">{task.title}</p>
                {/* Stacked on narrow screens, one line on wider ones. */}
                <div className="md:flex md:flex-wrap md:items-center md:gap-x-6">
                  <p className="text-gray-500 text-sm">
                    <span className="font-medium">Total Time:</span>{" "}
                    {formatDuration(task.totalSeconds, timeFormat)}
                  </p>
                  <p className="text-gray-500 text-sm">
                    <span className="font-medium">Priority:</span> {task.priority}
                  </p>
                  {task.startedAt && (
                    <p className="text-gray-500 text-sm">
                      <span className="font-medium">Started:</span>{" "}
                      {formatReportDate(new Date(task.startedAt))}
                    </p>
                  )}
                  <label className="block text-gray-500 text-sm">
                    <span className="font-medium">Status:</span>{" "}
                    <OptionSelect
                      value={task.status}
                      options={STATUSES}
                      onChange={onStatusChange}
                      className="border rounded px-1 py-0.5 bg-white/70 text-gray-700"
                    />
                    {task.statusNote && (
                      <span className="ml-2 italic">({task.statusNote})</span>
                    )}
                  </label>
                </div>
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
                className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600"
              >
                <Check />
              </button>
            ) : (
              <button
                onClick={startEditing}
                aria-label="Edit task"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-yellow-500 text-white hover:bg-yellow-600"
              >
                <Edit2 />
              </button>
            )}

            <button
              onClick={onDelete}
              aria-label="Delete task"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-500 text-white hover:bg-gray-600"
            >
              <Trash2 />
            </button>
          </div>
        </div>
      )}
    </Draggable>
  );
}
