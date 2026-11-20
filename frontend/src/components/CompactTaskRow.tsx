import type { DraggableProvided } from "@hello-pangea/dnd";
import { Ban, CheckCircle2, Circle, CircleDot, Hourglass } from "lucide-react";
import { PRIORITY_COLORS } from "../constants/priority";
import { STATUS_COLORS, canStart } from "../constants/status";
import { useJustBecame } from "../theme/moments";
import type { Status, Task } from "../types";
import PlayPauseButton from "./PlayPauseButton";

const STATUS_ICONS: Record<Status, typeof Circle> = {
  Todo: Circle,
  "In progress": CircleDot,
  Pending: Hourglass,
  Done: CheckCircle2,
  Canceled: Ban,
};

interface CompactTaskRowProps {
  task: Task;
  /** The whole row is the drag handle (desktop only; on a phone a swipe must scroll). */
  drag?: DraggableProvided;
  isNew?: boolean;
  /** Just set to Done, as seen by the list (a phone redraws it in Finished). */
  justDone?: boolean;
  onToggle: () => void;
}

/** One task in compact mode (docs/SPEC.md 16): title, status icon, Start/Pause. */
export default function CompactTaskRow({
  task,
  drag,
  isNew = false,
  justDone: justDoneInList = false,
  onToggle,
}: CompactTaskRowProps) {
  const justDone = useJustBecame(task.status === "Done") || justDoneInList;
  const StatusIcon = STATUS_ICONS[task.status];

  return (
    <div
      ref={drag?.innerRef}
      {...drag?.draggableProps}
      {...drag?.dragHandleProps}
      data-testid="task"
      data-status={task.status}
      data-new={isNew || undefined}
      data-just-done={justDone || undefined}
      data-task-id={task.id}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 shadow-sm ${
        STATUS_COLORS[task.status] ?? PRIORITY_COLORS[task.priority]
      } ${task.isRunning ? "glow" : ""}`}
    >
      <span role="img" aria-label={`Status: ${task.status}`} title={task.status} className="flex-shrink-0 text-fg-soft">
        <StatusIcon size={20} aria-hidden />
      </span>
      <p className="task-title min-w-0 flex-1 truncate font-medium text-fg-strong" title={task.title}>
        <span className="task-title-text">{task.title}</span>
      </p>
      <PlayPauseButton
        isRunning={task.isRunning}
        onClick={onToggle}
        disabled={!task.isRunning && !canStart(task.status)}
        title={canStart(task.status) ? undefined : `${task.status} tasks can't be started`}
        className="flex-shrink-0 !h-11 !w-11"
      />
    </div>
  );
}
