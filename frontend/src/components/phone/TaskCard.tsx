import type { DraggableProvided } from "@hello-pangea/dnd";
import { ChevronDown, Edit2, GripVertical, MoreVertical, Trash2 } from "lucide-react";
import { PRIORITY_COLORS } from "../../constants/priority";
import { STATUS_COLORS, canStart } from "../../constants/status";
import { useJustBecame } from "../../theme/moments";
import { useTaskEditing } from "../../hooks/useTaskEditing";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { formatReportDate } from "../../report/dailyReport";
import type { Task, TaskChanges } from "../../types";
import { formatDuration } from "../../utils/time";
import PlayPauseButton from "../PlayPauseButton";
import TaskEditForm from "../TaskEditForm";
import ActionMenu from "./ActionMenu";

interface TaskCardProps {
  task: Task;
  /** Set while the card is in the reorderable list; finished tasks have none. */
  drag?: DraggableProvided;
  isEditing: boolean;
  /** Just added: the theme may animate its arrival (docs/SPEC.md 15). */
  isNew?: boolean;
  /** Just set to Done, as seen by the list (its card is drawn anew when it moves). */
  justDone?: boolean;
  onStartEdit: () => void;
  onSave: (changes: TaskChanges) => Promise<void>;
  onToggle: () => void;
  onPause: () => Promise<Task | undefined>;
  /** Opens the status picker. */
  onPickStatus: () => void;
  onDelete: () => void;
}

const PRIORITY_DOT: Record<Task["priority"], string> = {
  Highest: "bg-row-highest-edge",
  High: "bg-row-high-edge",
  Normal: "bg-row-normal-edge",
  Low: "bg-row-low-edge",
};

const chip = "inline-flex items-center gap-1 rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-fg";

/** One task on the phone layout (docs/SPEC.md 14). */
export default function TaskCard({
  task,
  drag,
  isEditing,
  isNew = false,
  justDone: justDoneInList = false,
  onStartEdit,
  onSave,
  onToggle,
  onPause,
  onPickStatus,
  onDelete,
}: TaskCardProps) {
  const { draft, setDraft, startEditing, save } = useTaskEditing(task, onPause, onStartEdit, onSave);
  const timeFormat = useTimeFormat();
  const justDone = useJustBecame(task.status === "Done") || justDoneInList;

  return (
    <div
      ref={drag?.innerRef}
      {...drag?.draggableProps}
      data-testid="task"
      data-status={task.status}
      data-new={isNew || undefined}
      data-just-done={justDone || undefined}
      data-task-id={task.id}
      className={`rounded-xl p-3 shadow-sm ${STATUS_COLORS[task.status] ?? PRIORITY_COLORS[task.priority]} ${
        task.isRunning ? "glow" : ""
      }`}
    >
      <div className="flex items-start gap-1">
        {drag && (
          <span
            {...drag.dragHandleProps}
            aria-label="Drag to reorder"
            className="-ml-1 flex h-8 w-6 flex-shrink-0 items-center justify-center text-fg-faint"
          >
            <GripVertical size={18} />
          </span>
        )}
        <p className="task-title min-w-0 flex-1 break-words pt-1 font-medium leading-snug text-fg-strong">
          <span className="task-title-text">{task.title}</span>
        </p>
        {!isEditing && (
          <ActionMenu
            label="Task actions"
            trigger={<MoreVertical size={20} />}
            className="-mr-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-scrim/5"
            actions={[
              { label: "Edit task", icon: <Edit2 size={18} />, onSelect: startEditing },
              { label: "Delete task", icon: <Trash2 size={18} />, danger: true, onSelect: onDelete },
            ]}
          />
        )}
      </div>

      {isEditing ? (
        <div className="mt-2 space-y-3">
          <TaskEditForm draft={draft} onChange={setDraft} onSave={save} />
          <button
            onClick={save}
            aria-label="Save task"
            className="h-11 w-full rounded-lg bg-primary font-medium text-on-color hover:bg-primary-hover"
          >
            Save
          </button>
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button onClick={onPickStatus} aria-label={`Status: ${task.status}`} className={chip}>
              {task.status}
              <ChevronDown size={14} />
            </button>
            <span className={chip}>
              <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority]}`} aria-hidden />
              {task.priority}
            </span>
            {task.startedAt && (
              <span className={chip}>Started {formatReportDate(new Date(task.startedAt))}</span>
            )}
          </div>
          {task.statusNote && <p className="mt-1 text-sm italic text-fg-soft">{task.statusNote}</p>}

          <div className="mt-2 flex items-center justify-between">
            <span data-testid="task-time" className="task-time text-2xl font-semibold tabular-nums text-fg-strong">
              {formatDuration(task.totalSeconds, timeFormat)}
            </span>
            <PlayPauseButton
              isRunning={task.isRunning}
              onClick={onToggle}
              disabled={!task.isRunning && !canStart(task.status)}
              title={canStart(task.status) ? undefined : `${task.status} tasks can't be started`}
              className="!h-12 !w-12"
            />
          </div>
        </>
      )}
    </div>
  );
}
