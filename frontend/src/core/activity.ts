import type { Activity, TaskEvent, WorkSession } from "../types";

// Work history for the statistics screen. See docs/SPEC.md section 9.

/** Sessions that overlap `[from, to)` and events inside it, oldest first. */
export function activityBetween(
  sessions: Iterable<WorkSession>,
  events: Iterable<TaskEvent>,
  from: number,
  to: number
): Activity {
  return {
    sessions: [...sessions]
      .filter((s) => s.startedAt < to && (s.endedAt === null || s.endedAt > from))
      .sort((a, b) => a.startedAt - b.startedAt || a.id - b.id),
    events: [...events]
      .filter((e) => e.at >= from && e.at < to)
      .sort((a, b) => a.at - b.at || a.id - b.id),
  };
}
