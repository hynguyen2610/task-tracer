import type { Activity, Status } from "../types";
import { dayKey, dayRange } from "./dayStats";

// One task's work history across all days. See docs/SPEC.md 9.5.

export type TaskHistoryEntry =
  | { kind: "session"; at: number; end: number; ms: number; running: boolean }
  | { kind: "status"; at: number; status: Status }
  | { kind: "adjustment"; at: number; fromSeconds: number; toSeconds: number };

export interface TaskHistoryDay {
  /** "2026-11-06" */
  key: string;
  /** Local midnight the day starts at. */
  start: number;
  trackedMs: number;
  adjustmentMs: number;
  /** Tracked plus adjustments, never below 0. */
  totalMs: number;
  entries: TaskHistoryEntry[];
}

export interface TaskHistory {
  /** Oldest day first; only days with something recorded. */
  days: TaskHistoryDay[];
  trackedMs: number;
  adjustmentMs: number;
  totalMs: number;
  /** First recorded moment, or null if there is no history. */
  firstAt: number | null;
  /** Last recorded moment (now while a session runs). */
  lastAt: number | null;
  /** When it last became Done or Canceled, if that is its latest status. */
  finishedAt: number | null;
  finalStatus: Status | null;
}

/** Every session and event of task `taskId`, grouped by local day. */
export function buildTaskHistory(activity: Activity, taskId: number, now: number): TaskHistory {
  const days = new Map<string, TaskHistoryDay>();
  const dayOf = (ms: number) => {
    const key = dayKey(ms);
    let day = days.get(key);
    if (!day) {
      day = { key, start: dayRange(new Date(ms)).start, trackedMs: 0, adjustmentMs: 0, totalMs: 0, entries: [] };
      days.set(key, day);
    }
    return day;
  };

  let firstAt: number | null = null;
  let lastAt: number | null = null;
  const seen = (from: number, to: number) => {
    firstAt = firstAt === null ? from : Math.min(firstAt, from);
    lastAt = lastAt === null ? to : Math.max(lastAt, to);
  };

  for (const s of activity.sessions) {
    if (s.taskId !== taskId) continue;
    const end = s.endedAt ?? now;
    if (end <= s.startedAt) continue;
    seen(s.startedAt, end);
    // Split at each midnight, like the day statistics.
    let from = s.startedAt;
    while (from < end) {
      const to = Math.min(end, dayRange(new Date(from)).end);
      const day = dayOf(from);
      day.trackedMs += to - from;
      day.entries.push({ kind: "session", at: from, end: to, ms: to - from, running: s.endedAt === null && to === end });
      from = to;
    }
  }

  let lastStatus: { at: number; status: Status } | null = null;
  for (const e of activity.events) {
    if (e.taskId !== taskId) continue;
    seen(e.at, e.at);
    if (e.type === "status" && e.status) {
      dayOf(e.at).entries.push({ kind: "status", at: e.at, status: e.status });
      if (!lastStatus || e.at >= lastStatus.at) lastStatus = { at: e.at, status: e.status };
    } else if (e.type === "adjustment" && e.fromSeconds !== null && e.toSeconds !== null) {
      const day = dayOf(e.at);
      day.adjustmentMs += (e.toSeconds - e.fromSeconds) * 1000;
      day.entries.push({ kind: "adjustment", at: e.at, fromSeconds: e.fromSeconds, toSeconds: e.toSeconds });
    }
  }

  // Same instant: a status change (e.g. the automatic "In progress" on start),
  // then an adjustment, then the session starting.
  const order = { status: 0, adjustment: 1, session: 2 };
  const sorted = [...days.values()].sort((a, b) => a.start - b.start);
  for (const day of sorted) {
    day.totalMs = Math.max(0, day.trackedMs + day.adjustmentMs);
    day.entries.sort((a, b) => a.at - b.at || order[a.kind] - order[b.kind]);
  }

  const trackedMs = sorted.reduce((sum, d) => sum + d.trackedMs, 0);
  const adjustmentMs = sorted.reduce((sum, d) => sum + d.adjustmentMs, 0);
  const final: { at: number; status: Status } | null = lastStatus;
  const finished = final !== null && (final.status === "Done" || final.status === "Canceled");

  return {
    days: sorted,
    trackedMs,
    adjustmentMs,
    totalMs: Math.max(0, trackedMs + adjustmentMs),
    firstAt,
    lastAt,
    finishedAt: finished ? final.at : null,
    finalStatus: final?.status ?? null,
  };
}
