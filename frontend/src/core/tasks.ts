import type { Priority, Status, Task, TaskChanges, TaskEvent, WorkSession } from "../types";

// Task rules, run on the device. See docs/SPEC.md sections 4 and 5.
//
// A rule works on a Workspace: a copy of every task plus the open work
// sessions. It changes the copy and records what changed; the store then
// saves those changes in one transaction (see memoryStore.ts). The rules
// never read the clock: `now` is always passed in.

export const STATUSES: Status[] = ["Todo", "In progress", "Pending", "Done", "Canceled"];

/** Statuses whose timer can't be started. */
export const UNSTARTABLE: Status[] = ["Pending", "Done", "Canceled"];

/** The task a new, empty database starts with. */
export const FIRST_TASK_TITLE = "First task of the day";

/** A task as stored: what the screen sees, plus timer and list bookkeeping. */
export interface StoredTask extends Task {
  /** Epoch ms up to which running time has been added to `totalSeconds`. */
  lastStart: number | null;
  /** Place in the list, 0 at the top. */
  position: number;
}

export type NewTask = Omit<StoredTask, "id">;
export type NewSession = Omit<WorkSession, "id">;
export type NewEvent = Omit<TaskEvent, "id">;

/** What a rule read: every task, and the sessions that haven't ended. */
export interface Snapshot {
  tasks: StoredTask[];
  openSessions: WorkSession[];
}

/** What a rule changed, for the store to save. */
export interface Changes {
  putTasks: StoredTask[];
  addTasks: NewTask[];
  deleteTaskIds: number[];
  /** Existing sessions, now ended. */
  putSessions: WorkSession[];
  addSessions: NewSession[];
  addEvents: NewEvent[];
}

export type TaskErrorKind = "not-found" | "conflict" | "invalid";

/** A rule refused the request; `message` is shown to the user. */
export class TaskError extends Error {
  readonly kind: TaskErrorKind;
  constructor(kind: TaskErrorKind, message: string) {
    super(message);
    this.name = "TaskError";
    this.kind = kind;
  }
}

const notFound = () => new TaskError("not-found", "Task not found");

function isDate(ms: unknown): boolean {
  return typeof ms === "number" && Number.isInteger(ms) && ms >= 0;
}

export class Workspace {
  private readonly tasks = new Map<number, StoredTask>();
  private readonly open: WorkSession[];
  private readonly changedTasks = new Set<number>();
  private readonly closed = new Set<WorkSession>();
  private readonly added: { tasks: NewTask[]; sessions: NewSession[]; events: NewEvent[] } = {
    tasks: [],
    sessions: [],
    events: [],
  };
  private readonly deleted = new Set<number>();

  constructor(snapshot: Snapshot) {
    for (const t of snapshot.tasks) this.tasks.set(t.id, { ...t });
    this.open = snapshot.openSessions.filter((s) => s.endedAt === null).map((s) => ({ ...s }));
  }

  /** Every task, top of the list first. */
  all(): StoredTask[] {
    return [...this.tasks.values()].sort((a, b) => a.position - b.position || a.id - b.id);
  }

  get(id: number): StoredTask {
    const task = this.tasks.get(id);
    if (!task) throw notFound();
    return task;
  }

  set(id: number, fields: Partial<StoredTask>): void {
    Object.assign(this.get(id), fields);
    this.changedTasks.add(id);
  }

  addTask(task: NewTask): void {
    this.added.tasks.push(task);
  }

  deleteTask(id: number): void {
    if (this.tasks.delete(id)) {
      this.changedTasks.delete(id);
      this.deleted.add(id);
    }
  }

  openSession(taskId: number, taskTitle: string, now: number): void {
    this.added.sessions.push({ taskId, taskTitle, startedAt: now, endedAt: null });
  }

  /** Ends the open session of one task, or of every task when `taskId` is null. */
  closeSessions(taskId: number | null, now: number): void {
    const matches = (s: NewSession) => s.endedAt === null && (taskId === null || s.taskId === taskId);
    for (const s of this.open) {
      if (matches(s)) {
        s.endedAt = now;
        this.closed.add(s);
      }
    }
    for (const s of this.added.sessions) {
      if (matches(s)) s.endedAt = now;
    }
  }

  recordStatus(taskId: number, taskTitle: string, status: Status, now: number): void {
    this.added.events.push({ taskId, taskTitle, type: "status", at: now, status, fromSeconds: null, toSeconds: null });
  }

  recordAdjustment(taskId: number, taskTitle: string, fromSeconds: number, toSeconds: number, now: number): void {
    this.added.events.push({ taskId, taskTitle, type: "adjustment", at: now, status: null, fromSeconds, toSeconds });
  }

  changes(): Changes {
    return {
      putTasks: [...this.changedTasks].map((id) => ({ ...this.tasks.get(id)! })),
      addTasks: this.added.tasks.map((t) => ({ ...t })),
      deleteTaskIds: [...this.deleted],
      putSessions: [...this.closed].map((s) => ({ ...s })),
      addSessions: this.added.sessions.map((s) => ({ ...s })),
      addEvents: this.added.events.map((e) => ({ ...e })),
    };
  }
}

/**
 * Adds the time elapsed since `lastStart` to the running task.
 *
 * Only whole seconds are added, and `lastStart` moves forward by exactly that
 * much, so the leftover fraction carries over to the next update instead of
 * being lost on every poll.
 */
export function updateRunning(ws: Workspace, now: number): void {
  for (const t of ws.all()) {
    if (!t.isRunning || t.lastStart === null) continue;
    const elapsed = Math.floor(Math.max(0, now - t.lastStart) / 1000);
    if (elapsed > 0) {
      ws.set(t.id, {
        totalSeconds: t.totalSeconds + elapsed,
        lastStart: t.lastStart + elapsed * 1000,
        lastWorkedAt: now,
      });
    }
  }
}

/** Every task, with the running time brought up to date. */
export function listTasks(ws: Workspace, now: number): StoredTask[] {
  updateRunning(ws, now);
  return ws.all();
}

/**
 * Adds a task at the bottom, as Todo. `startedAt` reuses the start date of an
 * earlier task with the same title (SPEC 6.1).
 */
export function createTask(ws: Workspace, title: string, priority?: Priority, startedAt?: number | null): void {
  if (startedAt !== undefined && startedAt !== null && !isDate(startedAt)) {
    throw new TaskError("invalid", "startedAt must be a date (epoch ms)");
  }
  const positions = ws.all().map((t) => t.position);
  ws.addTask({
    title,
    totalSeconds: 0,
    isRunning: false,
    lastStart: null,
    position: positions.length > 0 ? Math.max(...positions) + 1 : 0,
    priority: priority ?? "Normal",
    status: "Todo",
    statusNote: null,
    startedAt: startedAt ?? null,
    lastWorkedAt: null,
  });
}

/** Starts or pauses a task (SPEC 4.3). Returns every task. */
export function toggleTask(ws: Workspace, id: number, now: number): StoredTask[] {
  updateRunning(ws, now);
  const task = ws.get(id);
  if (task.isRunning) {
    ws.set(id, { isRunning: false, lastWorkedAt: now });
    ws.closeSessions(id, now);
  } else {
    if (UNSTARTABLE.includes(task.status)) {
      throw new TaskError("conflict", `Cannot start a ${task.status} task`);
    }
    // Starting this task stops whichever one is running.
    ws.closeSessions(null, now);
    ws.openSession(id, task.title, now);
    if (task.status === "Todo") ws.recordStatus(id, task.title, "In progress", now);
    for (const other of ws.all()) {
      if (other.isRunning) ws.set(other.id, { isRunning: false });
    }
    ws.set(id, {
      isRunning: true,
      lastStart: now,
      lastWorkedAt: now,
      startedAt: task.startedAt ?? now,
      status: task.status === "Todo" ? "In progress" : task.status,
    });
  }
  return ws.all();
}

/** Applies an edit (SPEC 4.4). Missing or null fields keep their value; an empty `statusNote` clears the note. */
export function updateTask(ws: Workspace, id: number, changes: TaskChanges, now: number): void {
  const wanted = changes.status ?? null;
  if (wanted !== null && !STATUSES.includes(wanted)) {
    throw new TaskError("invalid", `status must be one of: ${STATUSES.join(", ")}`);
  }
  if (changes.startedAt !== undefined && changes.startedAt !== null && !isDate(changes.startedAt)) {
    throw new TaskError("invalid", "startedAt must be a date (epoch ms)");
  }
  ws.get(id);

  // A running task must stay In progress, so any other status stops the
  // timer. Bring its time up to date first so no elapsed time is lost.
  if (wanted !== null && wanted !== "In progress") {
    updateRunning(ws, now);
    ws.set(id, { isRunning: false });
    ws.closeSessions(id, now);
  }

  const current = { ...ws.get(id) };
  const title = changes.title ?? current.title;
  const totalSeconds = changes.totalSeconds ?? current.totalSeconds;
  const priority = changes.priority ?? current.priority;
  const status = wanted ?? current.status;
  const statusNote =
    changes.statusNote === undefined || changes.statusNote === null
      ? current.statusNote
      : changes.statusNote.trim() || null;

  const worked = status !== current.status || totalSeconds !== current.totalSeconds;
  // A date picked by hand wins; otherwise it is set once, on leaving Todo.
  const startedAt = changes.startedAt ?? current.startedAt ?? (status !== "Todo" ? now : null);

  ws.set(id, {
    title,
    totalSeconds,
    priority,
    status,
    statusNote,
    startedAt,
    lastWorkedAt: worked ? now : current.lastWorkedAt,
  });

  if (status !== current.status) ws.recordStatus(id, title, status, now);
  if (totalSeconds !== current.totalSeconds) {
    ws.recordAdjustment(id, title, current.totalSeconds, totalSeconds, now);
  }
}

/** Puts the tasks in the order of `ids`. Unknown ids are skipped. */
export function reorderTasks(ws: Workspace, ids: number[]): void {
  ids.forEach((id, position) => {
    try {
      ws.set(id, { position });
    } catch (e) {
      if (!(e instanceof TaskError)) throw e;
    }
  });
}

/** Deletes a task. Its work history stays, for the statistics. */
export function deleteTask(ws: Workspace, id: number, now: number): void {
  ws.closeSessions(id, now);
  ws.deleteTask(id);
}
