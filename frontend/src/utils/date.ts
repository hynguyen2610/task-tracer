const pad = (n: number) => String(n).padStart(2, "0");

/** A date as the value of an <input type="date">: "2026-11-06", in local time. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-11-06" -> epoch ms of local midnight that day, or null if empty or invalid. */
export function fromDateInput(value: string): number | null {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}
