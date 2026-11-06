const pad = (n: number) => String(n).padStart(2, "0");

/** 3725 -> "01:02:05" */
export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** 3725 -> "01:02" (seconds dropped) */
export function secondsToHHmm(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${pad(h)}:${pad(m)}`;
}

/** "01:02" -> 3720 */
export function hhmmToSeconds(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 3600 + m * 60;
}
