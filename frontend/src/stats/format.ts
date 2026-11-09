import { formatDuration, type TimeFormat } from "../utils/time";

const pad = (n: number) => String(n).padStart(2, "0");

/** Local time of day, 24-hour: "09:05". */
export function clock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * A duration in ms, in the chosen time format ("01:30:00" or "1.5 h").
 * Rounds down to whole seconds, like the timer, so a task's tracked time plus
 * its adjustments matches its Total Time.
 */
export function formatMs(ms: number, format: TimeFormat): string {
  return formatDuration(Math.floor(Math.max(0, ms) / 1000), format);
}

/** A signed change in seconds: "+00:30:00" / "−0.5 h". */
export function formatDelta(seconds: number, format: TimeFormat): string {
  const sign = seconds < 0 ? "−" : "+";
  return `${sign}${formatDuration(Math.abs(seconds), format)}`;
}
