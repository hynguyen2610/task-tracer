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
import { formatTime, hhmmToSeconds, secondsToHHmm } from "../utils/time";
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
  time: "",
  priority: DEFAULT_PRIORITY,
  status: DEFAULT_STATUS,
  statusNote: "",
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

  const startEditing = async () => {
    // Pause a running task first, so the form shows its up-to-date time and
    // no time is counted while it is being edited.
    const current = task.isRunning ? ((await onPause()) ?? task) : task;
    setDraft({
      title: current.title,
      time: secondsToHHmm(current.totalSeconds),
      priority: current.priority,
      status: current.status,
      statusNote: current.statusNote ?? "",
    });
    onStartEdit();
  };

  const save = async () => {
    await onSave({
      title: draft.title,
      totalSeconds: hhmmToSeconds(draft.time),
      priority: draft.priority,
      status: draft.status,
      statusNote: draft.statusNote,
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
          className={`flex items-center justify-between p-4 rounded-xl shadow-sm ${
            STATUS_COLORS[task.status] ?? PRIORITY_COLORS[task.priority]
          } ${task.isRunning ? "glow border-blue-500" : ""}`}
        >
          <div className="flex items-center flex-1">
            <div className="flex-shrink-0 mr-4">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold">
                {index + 1}
              </div>
            </div>

            {isEditing ? (
              <TaskEditForm draft={draft} onChange={setDraft} onSave={save} />
            ) : (
              <div>
                <p className="font-medium text-gray-800">{task.title}</p>
                <p className="text-gray-500 text-sm">
                  <span className="font-medium">Total Time:</span>{" "}
                  {formatTime(task.totalSeconds)}
                </p>
                <p className="text-gray-500 text-sm">
                  <span className="font-medium">Priority:</span> {task.priority}
                </p>
                <label className="text-gray-500 text-sm">
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
            )}
          </div>

          <div className="flex items-center space-x-2">
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
