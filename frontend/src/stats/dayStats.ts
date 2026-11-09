import type { Activity, Status } from "../types";
import { DEFAULT_WORKDAY, overlapMs, workWindows, type WorkdaySettings } from "./workday";

// Turns raw work history into one day's statistics. See docs/SPEC.md 9.

/** Gaps shorter than this count as work, not as a break. */
export const MIN_BREAK_MS = 2 * 60 * 1000;

/** One stretch of work on one task, clipped to the day. */
export interface Segment {
  taskId: number;
  title: string;
  /** The task has been deleted since; `title` is its last known title. */
  deleted: boolean;
  start: number;
  end: number;
  /** Began before the day started. */
  fromPreviousDay: boolean;
  /** Still running at `now`. */
  running: boolean;
  /** Runs past the end of the day. */
  intoNextDay: boolean;
}

export type TimelineEntry =
  | { kind: "start"; at: number; segment: Segment }
  | { kind: "stop"; at: number; segment: Segment; workedMs: number }
  /** `ms` is the part of `at`–`end` inside working hours, outside lunch. */
  | { kind: "break"; at: number; end: number; ms: number }
  | { kind: "status"; at: number; taskId: number; title: string; status: Status }
  | { kind: "adjustment"; at: number; taskId: number; title: string; fromSeconds: number; toSeconds: number };

export interface TaskTotal {
  taskId: number;
  title: string;
  deleted: boolean;
  trackedMs: number;
  adjustmentMs: number;
  totalMs: number;
}

export interface DayStats {
  segments: Segment[];
  entries: TimelineEntry[];
  /** First start to last stop, or null if nothing was tracked. */
  span: { start: number; end: number } | null;
  /** Timer time, plus gaps too short to be breaks. */
  trackedMs: number;
  /** Sum of time adjustments made this day (can be negative). */
  adjustmentMs: number;
  /** Tracked plus adjustments, never below 0. */
  workMs: number;
  /** Breaks inside working hours, outside lunch. */
  breakMs: number;
  perTask: TaskTotal[];
}

/** Local midnight at the start of the day `date` is in, and the next one. */
export function dayRange(date: Date): { start: number; end: number } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/** "2026-11-06" for the local day `ms` falls in. */
export function dayKey(ms: number | Date): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Statistics for the day `[dayStart, dayEnd)`.
 *
 * @param titles current titles of tasks that still exist, by id; others are
 *   treated as deleted and keep the title stored with their history.
 * @param workday working hours; only the part of a break inside them, and
 *   outside lunch, counts.
 */
export function buildDayStats(
  activity: Activity,
  dayStart: number,
  dayEnd: number,
  now: number,
  titles: Map<number, string>,
  workday: WorkdaySettings = DEFAULT_WORKDAY
): DayStats {
  const windows = workWindows(dayStart, workday);
  const nameOf = (taskId: number, stored: string) => ({
    title: titles.get(taskId) ?? stored,
    deleted: !titles.has(taskId),
  });

  const segments: Segment[] = activity.sessions
    .map((s) => {
      const realEnd = s.endedAt ?? now;
      return {
        taskId: s.taskId,
        ...nameOf(s.taskId, s.taskTitle),
        start: Math.max(s.startedAt, dayStart),
        end: Math.min(realEnd, dayEnd),
        fromPreviousDay: s.startedAt < dayStart,
        running: s.endedAt === null && now < dayEnd,
        intoNextDay: realEnd > dayEnd,
      };
    })
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const entries: TimelineEntry[] = [];
  let trackedMs = 0;
  let breakMs = 0;
  let coveredUntil: number | null = null;

  for (const segment of segments) {
    if (coveredUntil !== null && segment.start > coveredUntil) {
      const gap = segment.start - coveredUntil;
      if (gap >= MIN_BREAK_MS) {
        // Gaps outside working hours or during lunch aren't breaks.
        const counted = overlapMs(coveredUntil, segment.start, windows);
        if (counted > 0) {
          breakMs += counted;
          entries.push({ kind: "break", at: coveredUntil, end: segment.start, ms: counted });
        }
      } else {
        trackedMs += gap;
      }
    }
    // Sessions never overlap in practice (one timer at a time), but only
    // count the part not already covered, to be safe.
    const from = coveredUntil === null ? segment.start : Math.max(segment.start, coveredUntil);
    trackedMs += Math.max(0, segment.end - from);
    coveredUntil = Math.max(coveredUntil ?? segment.end, segment.end);

    entries.push({ kind: "start", at: segment.start, segment });
    if (!segment.running && !segment.intoNextDay) {
      entries.push({ kind: "stop", at: segment.end, segment, workedMs: segment.end - segment.start });
    }
  }

  let adjustmentMs = 0;
  const adjustmentsByTask = new Map<number, number>();
  for (const e of activity.events) {
    if (e.at < dayStart || e.at >= dayEnd) continue;
    const { title } = nameOf(e.taskId, e.taskTitle);
    if (e.type === "status" && e.status) {
      entries.push({ kind: "status", at: e.at, taskId: e.taskId, title, status: e.status });
    } else if (e.type === "adjustment" && e.fromSeconds !== null && e.toSeconds !== null) {
      const ms = (e.toSeconds - e.fromSeconds) * 1000;
      adjustmentMs += ms;
      adjustmentsByTask.set(e.taskId, (adjustmentsByTask.get(e.taskId) ?? 0) + ms);
      entries.push({
        kind: "adjustment",
        at: e.at,
        taskId: e.taskId,
        title,
        fromSeconds: e.fromSeconds,
        toSeconds: e.toSeconds,
      });
    }
  }

  // Same instant: a stop, then the status change that caused it, then the
  // break that follows, then the next start.
  const order: Record<TimelineEntry["kind"], number> = {
    stop: 0,
    status: 1,
    adjustment: 2,
    break: 3,
    start: 4,
  };
  entries.sort((a, b) => a.at - b.at || order[a.kind] - order[b.kind]);

  const perTaskMap = new Map<number, TaskTotal>();
  const totalFor = (taskId: number, stored: string) => {
    let t = perTaskMap.get(taskId);
    if (!t) {
      t = { taskId, ...nameOf(taskId, stored), trackedMs: 0, adjustmentMs: 0, totalMs: 0 };
      perTaskMap.set(taskId, t);
    }
    return t;
  };
  for (const s of segments) totalFor(s.taskId, s.title).trackedMs += s.end - s.start;
  for (const e of activity.events) {
    if (e.type === "adjustment" && adjustmentsByTask.has(e.taskId)) {
      totalFor(e.taskId, e.taskTitle).adjustmentMs = adjustmentsByTask.get(e.taskId)!;
    }
  }
  const perTask = [...perTaskMap.values()]
    .map((t) => ({ ...t, totalMs: Math.max(0, t.trackedMs + t.adjustmentMs) }))
    .sort((a, b) => b.totalMs - a.totalMs);

  const span =
    segments.length > 0
      ? { start: segments[0].start, end: Math.max(...segments.map((s) => s.end)) }
      : null;

  return {
    segments,
    entries,
    span,
    trackedMs,
    adjustmentMs,
    workMs: Math.max(0, trackedMs + adjustmentMs),
    breakMs,
    perTask,
  };
}

/** Local days (as `dayKey`s) with any tracked time or adjustment in `activity`. */
export function activeDays(activity: Activity, now: number): Set<string> {
  const days = new Set<string>();
  for (const s of activity.sessions) {
    const end = s.endedAt ?? now;
    // Mark every day the session touches.
    let day = dayRange(new Date(s.startedAt));
    while (day.start < end) {
      days.add(dayKey(day.start));
      day = dayRange(new Date(day.end));
    }
  }
  for (const e of activity.events) {
    if (e.type === "adjustment") days.add(dayKey(e.at));
  }
  return days;
}
