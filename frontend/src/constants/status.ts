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
  "In progress": "bg-row-progress border-l-4 border-row-progress-edge",
  Pending: "bg-row-pending border-l-4 border-row-pending-edge",
  Done: "bg-row-done border-l-4 border-row-done-edge",
};

/** Pending, Done and Canceled tasks can't be started. */
export function canStart(status: Status): boolean {
  return status === "Todo" || status === "In progress";
}

/** Done and Canceled tasks are finished: the phone layout folds them away. */
export function isFinished(task: { status: Status }): boolean {
  return task.status === "Done" || task.status === "Canceled";
}
