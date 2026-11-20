export type Priority = "Highest" | "High" | "Normal" | "Low";

export type Status = "Todo" | "In progress" | "Pending" | "Done" | "Canceled";

export interface Task {
  id: number;
  title: string;
  totalSeconds: number;
  isRunning: boolean;
  priority: Priority;
  status: Status;
  /** Short note shown after the status, e.g. "Waiting for Kiro". */
  statusNote: string | null;
  /** Epoch ms when the task first left Todo. */
  startedAt: number | null;
  /** Epoch ms of the last tracked time, time edit or status change. */
  lastWorkedAt: number | null;
  /** Estimated hours to finish the task, a whole number of at least 1. */
  etaHours: number | null;
  /** Epoch ms of the due date (local midnight); the task is due by the end of that day. */
  dueAt: number | null;
}

/**
 * Fields the user can change from the edit form. Fields left out keep their
 * value; for `etaHours` and `dueAt`, null clears them.
 */
export type TaskChanges = Partial<
  Pick<Task, "title" | "totalSeconds" | "priority" | "status" | "statusNote" | "startedAt" | "etaHours" | "dueAt">
>;

/** One stretch of the timer running on one task. */
export interface WorkSession {
  id: number;
  taskId: number;
  /** Title when the session started; kept after renames and deletes. */
  taskTitle: string;
  startedAt: number;
  /** null while the timer is still running. */
  endedAt: number | null;
}

/** A status change, or a total time typed in the edit form ("adjustment"). */
export interface TaskEvent {
  id: number;
  taskId: number;
  taskTitle: string;
  type: "status" | "adjustment";
  at: number;
  status: Status | null;
  fromSeconds: number | null;
  toSeconds: number | null;
}

/** Work history for a time range. */
export interface Activity {
  sessions: WorkSession[];
  events: TaskEvent[];
}
