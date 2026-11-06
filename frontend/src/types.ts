export type Priority = "Highest" | "High" | "Normal" | "Low";

export interface Task {
  id: number;
  title: string;
  totalSeconds: number;
  isRunning: boolean;
  priority: Priority;
}

/** Fields the user can change from the edit form. */
export type TaskChanges = Pick<Task, "title" | "totalSeconds" | "priority">;
