// Working hours: breaks only count inside them, and never during lunch.
// See docs/SPEC.md 9.4.

/** Times of day, in minutes after midnight. */
export interface WorkdaySettings {
  start: number;
  lunchStart: number;
  lunchEnd: number;
  end: number;
}

/** 08:30–18:00, lunch 12:00–13:30. */
export const DEFAULT_WORKDAY: WorkdaySettings = {
  start: 8 * 60 + 30,
  lunchStart: 12 * 60,
  lunchEnd: 13 * 60 + 30,
  end: 18 * 60,
};

const DAY_MINUTES = 24 * 60;

/** Why the settings can't be used, or null if they're fine. */
export function workdayError(w: WorkdaySettings): string | null {
  const values = [w.start, w.lunchStart, w.lunchEnd, w.end];
  if (values.some((v) => !Number.isInteger(v) || v < 0 || v > DAY_MINUTES)) {
    return "Every time must be a time of day.";
  }
  if (w.start >= w.end) return "The workday must end after it starts.";
  if (w.lunchStart > w.lunchEnd) return "Lunch must end after it starts.";
  if (w.lunchStart < w.start || w.lunchEnd > w.end) return "Lunch must be inside the workday.";
  return null;
}

/** 510 -> "08:30" */
export function minutesToClock(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** "08:30" -> 510, or null if it isn't hh:mm. */
export function clockToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? h * 60 + m : null;
}

/**
 * The stretches of the day starting at local midnight `dayStart` in which
 * breaks count: workday start to lunch, and lunch to workday end.
 */
export function workWindows(dayStart: number, w: WorkdaySettings): { start: number; end: number }[] {
  const d = new Date(dayStart);
  // Built from the local date, so a DST change that day is handled.
  const at = (minutes: number) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes).getTime();
  return [
    { start: at(w.start), end: at(w.lunchStart) },
    { start: at(w.lunchEnd), end: at(w.end) },
  ].filter((win) => win.end > win.start);
}

/** How much of `[from, to)` falls inside `windows`. */
export function overlapMs(from: number, to: number, windows: { start: number; end: number }[]): number {
  let ms = 0;
  for (const win of windows) ms += Math.max(0, Math.min(to, win.end) - Math.max(from, win.start));
  return ms;
}

const KEY = "workday";

/** The saved settings, or the defaults if none (or unusable ones) are saved. */
export function loadWorkday(): WorkdaySettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (saved && typeof saved === "object") {
      const w = { ...DEFAULT_WORKDAY, ...saved } as WorkdaySettings;
      if (!workdayError(w)) return w;
    }
  } catch {
    // storage blocked or unreadable: use the defaults
  }
  return DEFAULT_WORKDAY;
}

export function saveWorkday(w: WorkdaySettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    // not saved; still applies until the app is closed
  }
}
