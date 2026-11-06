export const STATUSES = ["Todo", "In progress", "Done", "Canceled"] as const
export type Status = (typeof STATUSES)[number]

/** Statuses whose timer can't be started. */
export const CLOSED_STATUSES: readonly Status[] = ["Done", "Canceled"]

export interface Task {
  id: number
  title: string
  totalSeconds: number
  isRunning: boolean
  lastStart: number | null
  position: number
  priority: "Highest" | "High" | "Normal" | "Low"
  status: Status
}
