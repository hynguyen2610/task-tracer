const pad = (n: number) => String(n).padStart(2, "0");

/** How durations are shown and typed: "01:30" or "1.5". */
export type TimeFormat = "hhmm" | "decimal";

export const DEFAULT_TIME_FORMAT: TimeFormat = "hhmm";

/** 3725 -> "01:02:05" */
export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** 5400 -> "1.5", 4500 -> "1.25": hours to at most 2 decimals, no trailing zeros. */
export function secondsToHours(totalSeconds: number): string {
  return String(Number((totalSeconds / 3600).toFixed(2)));
}

/**
 * A duration for display: "01:30:00" (seconds kept, so a running timer
 * visibly ticks) or "1.5 h".
 */
export function formatDuration(totalSeconds: number, format: TimeFormat): string {
  return format === "decimal" ? `${secondsToHours(totalSeconds)} h` : formatTime(totalSeconds);
}

/** 3725 -> "01:02" (seconds dropped) */
export function secondsToHHmm(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${pad(h)}:${pad(m)}`;
}

/** "01:02" -> 3720. Minutes above 59 count as 59; anything unreadable as 0. */
export function hhmmToSeconds(value: string): number {
  const [h, m] = value.split(":").map((part) => Number(part) || 0);
  return h * 3600 + Math.min(m ?? 0, 59) * 60;
}

/** "1.5" or "1,5" -> 5400; anything unreadable -> 0. */
export function hoursToSeconds(value: string): number {
  const hours = Number(value.replace(",", "."));
  return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 3600) : 0;
}

/** Text for the duration field: "01:30" or "1.5". */
export function durationToInput(totalSeconds: number, format: TimeFormat): string {
  return format === "decimal" ? secondsToHours(totalSeconds) : secondsToHHmm(totalSeconds);
}

/** Reads the duration field back into seconds. */
export function inputToDuration(value: string, format: TimeFormat): number {
  return format === "decimal" ? hoursToSeconds(value) : hhmmToSeconds(value);
}

/** Drops characters the format can't contain while typing. */
export function sanitizeDurationInput(value: string, format: TimeFormat): string {
  return value.replace(format === "decimal" ? /[^0-9.,]/g : /[^0-9:]/g, "");
}
