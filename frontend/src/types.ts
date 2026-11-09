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
}

/** Fields the user can change from the edit form. Fields left out keep their value. */
export type TaskChanges = Partial<
  Pick<Task, "title" | "totalSeconds" | "priority" | "status" | "statusNote" | "startedAt">
>;
