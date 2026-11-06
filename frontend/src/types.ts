export type Priority = "Highest" | "High" | "Normal" | "Low";

export type Status = "Todo" | "In progress" | "Done" | "Canceled";

export interface Task {
  id: number;
  title: string;
  totalSeconds: number;
  isRunning: boolean;
  priority: Priority;
  status: Status;
}

/** Fields the user can change from the edit form. */
export type TaskChanges = Pick<
  Task,
  "title" | "totalSeconds" | "priority" | "status"
>;
