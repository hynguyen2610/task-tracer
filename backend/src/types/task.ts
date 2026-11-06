export const STATUSES = ["Todo", "In progress", "Pending", "Done", "Canceled"] as const
export type Status = (typeof STATUSES)[number]

/** Statuses whose timer can't be started. */
export const UNSTARTABLE_STATUSES: readonly Status[] = ["Pending", "Done", "Canceled"]

export interface Task {
  id: number
  title: string
  totalSeconds: number
  isRunning: boolean
  lastStart: number | null
  position: number
  priority: "Highest" | "High" | "Normal" | "Low"
  status: Status
  /** Short note shown after the status, e.g. "Waiting for Kiro". */
  statusNote: string | null
  /** Epoch ms when the task first left Todo. */
  startedAt: number | null
  /** Epoch ms of the last tracked time, time edit or status change. */
  lastWorkedAt: number | null
}
