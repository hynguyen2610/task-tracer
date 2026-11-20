import { useState } from "react";
import { DEFAULT_PRIORITY } from "../constants/priority";
import { DEFAULT_STATUS } from "../constants/status";
import type { TaskDraft } from "../components/TaskEditForm";
import type { Task, TaskChanges } from "../types";
import { fromDateInput, toDateInput } from "../utils/date";
import { isEta } from "../core/tasks";

const emptyDraft: TaskDraft = {
  title: "",
  totalSeconds: 0,
  timeEdited: false,
  priority: DEFAULT_PRIORITY,
  status: DEFAULT_STATUS,
  statusNote: "",
  startDate: "",
  startDateEdited: false,
  etaHours: "",
  etaEdited: false,
  dueDate: "",
  dueDateEdited: false,
};

/** The typed ETA: a whole number of hours, or null when empty or not a valid ETA. */
export function parseEta(text: string): number | null {
  const hours = Number(text.trim());
  return text.trim() !== "" && isEta(hours) ? hours : null;
}

/** The edit form's draft of one task, shared by the desktop row and the phone card. */
export function useTaskEditing(
  task: Task,
  onPause: () => Promise<Task | undefined>,
  onStartEdit: () => void,
  onSave: (changes: TaskChanges) => Promise<void>
) {
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);

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
      etaHours: current.etaHours === null ? "" : String(current.etaHours),
      etaEdited: false,
      dueDate: current.dueAt === null ? "" : toDateInput(new Date(current.dueAt)),
      dueDateEdited: false,
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
      // Only changed fields are sent; emptying one clears it (null).
      etaHours: draft.etaEdited ? parseEta(draft.etaHours) : undefined,
      dueAt: draft.dueDateEdited ? fromDateInput(draft.dueDate) : undefined,
    });
    setDraft(emptyDraft);
  };

  return { draft, setDraft, startEditing, save };
}
