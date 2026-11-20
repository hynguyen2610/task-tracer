import { isFinished } from "../constants/status";
import type { Task } from "../types";

const DAY = 86_400_000;

export type DueTone = "ok" | "soon" | "late";

export interface DueProgress {
  /** Share of the time from the start date to the due date that has passed, 0–1; null without a start date. */
  fraction: number | null;
  tone: DueTone;
  /** For example "3 days left", "Due today", "Overdue by 2 days". */
  label: string;
}

/** From 75% of the time used, a task is due soon. */
export const SOON = 0.75;

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Whole calendar days from today to the due date (negative once it has passed). */
function daysLeft(dueAt: number, now: number): number {
  return Math.round((startOfDay(dueAt) - startOfDay(now)) / DAY);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * How far a task is from its due date (docs/SPEC.md 4.7). Null when it has
 * no due date or is finished. The time runs from the start of the start date
 * to the end of the due date.
 */
export function dueProgress(task: Pick<Task, "startedAt" | "dueAt" | "status">, now: number): DueProgress | null {
  if (task.dueAt === null || isFinished(task)) return null;
  const left = daysLeft(task.dueAt, now);
  const label =
    left > 0 ? `${plural(left, "day")} left` : left === 0 ? "Due today" : `Overdue by ${plural(-left, "day")}`;

  if (task.startedAt === null) {
    return { fraction: null, tone: left < 0 ? "late" : left === 0 ? "soon" : "ok", label: left > 0 ? `Due in ${plural(left, "day")}` : label };
  }
  const from = startOfDay(task.startedAt);
  const to = startOfDay(task.dueAt) + DAY;
  const fraction = to <= from ? 1 : Math.min(1, Math.max(0, (now - from) / (to - from)));
  const tone: DueTone = now >= to ? "late" : fraction >= SOON ? "soon" : "ok";
  return { fraction, tone, label };
}
