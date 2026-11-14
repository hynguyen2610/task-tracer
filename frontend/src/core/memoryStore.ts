import type { Activity, Priority, TaskChanges, TaskEvent, WorkSession } from "../types";
import { activityBetween } from "./activity";
import {
  createTask,
  deleteTask,
  FIRST_TASK_TITLE,
  listTasks,
  reorderTasks,
  toggleTask,
  updateTask,
  Workspace,
  type Changes,
  type StoredTask,
} from "./tasks";

/**
 * The task rules over plain arrays, saved all-or-nothing like a transaction.
 * The reference for the IndexedDB store, and what the unit tests run against.
 */
export class MemoryStore {
  tasks: StoredTask[] = [];
  sessions: WorkSession[] = [];
  events: TaskEvent[] = [];
  private nextId = { task: 1, session: 1, event: 1 };

  /** A new store starts with one Todo task, like a new database. */
  constructor({ seed = true } = {}) {
    if (seed) this.createTask(FIRST_TASK_TITLE, undefined, undefined);
  }

  getTasks(now: number): StoredTask[] {
    return this.run((ws) => listTasks(ws, now)).result;
  }

  createTask(title: string, priority?: Priority, startedAt?: number | null): StoredTask {
    const { added } = this.run((ws) => createTask(ws, title, priority, startedAt));
    return added[0];
  }

  toggleTask(id: number, now: number): StoredTask[] {
    return this.run((ws) => toggleTask(ws, id, now)).result;
  }

  updateTask(id: number, changes: TaskChanges, now: number): void {
    this.run((ws) => updateTask(ws, id, changes, now));
  }

  reorderTasks(ids: number[]): void {
    this.run((ws) => reorderTasks(ws, ids));
  }

  deleteTask(id: number, now: number): void {
    this.run((ws) => deleteTask(ws, id, now));
  }

  getActivity(from: number, to: number): Activity {
    return activityBetween(this.sessions, this.events, from, to);
  }

  /** Runs a rule on a copy and saves its changes; nothing is saved if it throws. */
  private run<T>(rule: (ws: Workspace) => T): { result: T; added: StoredTask[] } {
    const ws = new Workspace({
      tasks: this.tasks,
      openSessions: this.sessions.filter((s) => s.endedAt === null),
    });
    const result = rule(ws);
    const added = this.save(ws.changes());
    return { result: copy(result), added };
  }

  private save(changes: Changes): StoredTask[] {
    const byId = new Map(this.tasks.map((t) => [t.id, t]));
    for (const t of changes.putTasks) byId.set(t.id, t);
    const added = changes.addTasks.map((t) => ({ ...t, id: this.nextId.task++ }));
    for (const t of added) byId.set(t.id, t);
    for (const id of changes.deleteTaskIds) byId.delete(id);
    this.tasks = [...byId.values()];

    const ended = new Map(changes.putSessions.map((s) => [s.id, s]));
    this.sessions = this.sessions.map((s) => ended.get(s.id) ?? s);
    for (const s of changes.addSessions) this.sessions.push({ ...s, id: this.nextId.session++ });
    for (const e of changes.addEvents) this.events.push({ ...e, id: this.nextId.event++ });
    return added.map((t) => ({ ...t }));
  }
}

/** So callers can't change the stored rows through what they got back. */
function copy<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}
