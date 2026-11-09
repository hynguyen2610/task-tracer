import type { Task } from "../types";

// Finding earlier tasks with the same or a similar title, for the add form.
// See docs/SPEC.md 6.1.

/** Lower case, trimmed, single spaces: "  Fix  Login " -> "fix login". */
export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Edits (insert, delete, replace) to turn `a` into `b`. */
export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Of several tasks with the same title, the one started earliest (unstarted last). */
function earliest(a: Task, b: Task): Task {
  if (a.startedAt === null) return b;
  if (b.startedAt === null) return a;
  return b.startedAt < a.startedAt ? b : a;
}

/** The task whose title matches exactly (ignoring case and spaces), started earliest. */
export function findExactMatch(tasks: Task[], title: string): Task | undefined {
  const wanted = normalizeTitle(title);
  if (!wanted) return undefined;
  return tasks.filter((t) => normalizeTitle(t.title) === wanted).reduce<Task | undefined>(
    (best, t) => (best ? earliest(best, t) : t),
    undefined
  );
}

/**
 * Existing tasks whose title is like `typed`, best first: exact, then starts
 * with it, then contains it, then a few typos away. One per title.
 */
export function suggestTasks(tasks: Task[], typed: string, limit = 6): Task[] {
  const wanted = normalizeTitle(typed);
  if (wanted.length < 2) return [];
  const maxTypos = Math.max(1, Math.floor(wanted.length / 5));

  const byTitle = new Map<string, { task: Task; rank: number }>();
  for (const task of tasks) {
    const title = normalizeTitle(task.title);
    let rank: number;
    if (title === wanted) rank = 0;
    else if (title.startsWith(wanted)) rank = 1;
    else if (title.includes(wanted)) rank = 2;
    else if (editDistance(title, wanted) <= maxTypos) rank = 3;
    else continue;
    const seen = byTitle.get(title);
    byTitle.set(title, { task: seen ? earliest(seen.task, task) : task, rank });
  }
  return [...byTitle.values()]
    .sort((a, b) => a.rank - b.rank || a.task.title.localeCompare(b.task.title))
    .slice(0, limit)
    .map((m) => m.task);
}
