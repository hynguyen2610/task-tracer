import type { Status } from "../types";

export const STATUSES: Status[] = ["Todo", "In progress", "Done", "Canceled"];

export const DEFAULT_STATUS: Status = "Todo";

/** Done and Canceled tasks can't be started. */
export function canStart(status: Status): boolean {
  return status !== "Done" && status !== "Canceled";
}
