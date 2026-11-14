import type { Status } from "../types";

export const STATUSES: Status[] = [
  "Todo",
  "In progress",
  "Pending",
  "Done",
  "Canceled",
];

export const DEFAULT_STATUS: Status = "Todo";

/**
 * Row colors that replace the priority color for a status. Done uses a
 * stronger green than Normal priority so the two stay distinguishable.
 * Todo and Canceled keep the priority color.
 */
export const STATUS_COLORS: Partial<Record<Status, string>> = {
  "In progress": "bg-sky-100 border-l-4 border-sky-500",
  Pending: "bg-amber-100 border-l-4 border-amber-500",
  Done: "bg-emerald-200 border-l-4 border-emerald-600",
};

/** Pending, Done and Canceled tasks can't be started. */
export function canStart(status: Status): boolean {
  return status === "Todo" || status === "In progress";
}

/** Done and Canceled tasks are finished: the phone layout folds them away. */
export function isFinished(task: { status: Status }): boolean {
  return task.status === "Done" || task.status === "Canceled";
}
