import { openDB, type DBSchema, type IDBPDatabase } from "idb";
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

// The task rules over IndexedDB, in the browser's storage on this device.
// Every call is one read-write transaction over all stores, so it is
// all-or-nothing, and two open tabs can't both add the same running time.
// Same behaviour as memoryStore.ts; see docs/SPEC.md 10.

/** A session as stored. `open` is set only while it runs, so the "open" index lists just those. */
type StoredSession = WorkSession & { open?: 1 };

interface TrackerSchema extends DBSchema {
  tasks: { key: number; value: StoredTask };
  sessions: { key: number; value: StoredSession; indexes: { startedAt: number; open: number } };
  events: { key: number; value: TaskEvent; indexes: { at: number } };
}

type Db = IDBPDatabase<TrackerSchema>;

export const DB_NAME = "task-tracker";
const STORES = ["tasks", "sessions", "events"] as const;

const toStored = (s: WorkSession | Omit<WorkSession, "id">): StoredSession =>
  (s.endedAt === null ? { ...s, open: 1 } : { ...s }) as StoredSession;

function fromStored(stored: StoredSession): WorkSession {
  const s = { ...stored };
  delete s.open;
  return s;
}

export class IdbStore {
  private readonly db: Db;

  private constructor(db: Db) {
    this.db = db;
  }

  /** Opens the database, creating it with one Todo task the first time. */
  static async open(name = DB_NAME): Promise<IdbStore> {
    const db = await openDB<TrackerSchema>(name, 1, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore("tasks", { keyPath: "id", autoIncrement: true });
          const sessions = db.createObjectStore("sessions", { keyPath: "id", autoIncrement: true });
          sessions.createIndex("startedAt", "startedAt");
          sessions.createIndex("open", "open");
          const events = db.createObjectStore("events", { keyPath: "id", autoIncrement: true });
          events.createIndex("at", "at");

          const ws = new Workspace({ tasks: [], openSessions: [] });
          createTask(ws, FIRST_TASK_TITLE);
          void tx.objectStore("tasks").add(ws.changes().addTasks[0] as StoredTask);
        }
      },
      // A newer version of the app in another tab needs the database.
      blocking() {
        db.close();
      },
    });
    return new IdbStore(db);
  }

  close(): void {
    this.db.close();
  }

  async getTasks(now: number): Promise<StoredTask[]> {
    return (await this.run((ws) => listTasks(ws, now))).result;
  }

  async createTask(title: string, priority?: Priority, startedAt?: number | null): Promise<StoredTask> {
    return (await this.run((ws) => createTask(ws, title, priority, startedAt))).added[0];
  }

  async toggleTask(id: number, now: number): Promise<StoredTask[]> {
    return (await this.run((ws) => toggleTask(ws, id, now))).result;
  }

  async updateTask(id: number, changes: TaskChanges, now: number): Promise<void> {
    await this.run((ws) => updateTask(ws, id, changes, now));
  }

  async reorderTasks(ids: number[]): Promise<void> {
    await this.run((ws) => reorderTasks(ws, ids));
  }

  async deleteTask(id: number, now: number): Promise<void> {
    await this.run((ws) => deleteTask(ws, id, now));
  }

  /** Sessions overlapping `[from, to)` and events inside it, oldest first. */
  async getActivity(from: number, to: number): Promise<Activity> {
    if (!(to > from)) return { sessions: [], events: [] };
    const tx = this.db.transaction(["sessions", "events"], "readonly");
    const [sessions, events] = await Promise.all([
      tx.objectStore("sessions").index("startedAt").getAll(IDBKeyRange.upperBound(to, true)),
      tx.objectStore("events").index("at").getAll(IDBKeyRange.bound(from, to, false, true)),
    ]);
    await tx.done;
    return activityBetween(sessions.map(fromStored), events, from, to);
  }

  /** Runs a rule on what is stored and saves its changes, in one transaction. */
  private async run<T>(rule: (ws: Workspace) => T): Promise<{ result: T; added: StoredTask[] }> {
    const tx = this.db.transaction(STORES, "readwrite");
    const [tasks, open] = await Promise.all([
      tx.objectStore("tasks").getAll(),
      tx.objectStore("sessions").index("open").getAll(),
    ]);

    let result: T;
    let changes: Changes;
    try {
      const ws = new Workspace({ tasks, openSessions: open.map(fromStored) });
      result = rule(ws);
      changes = ws.changes();
    } catch (e) {
      tx.abort();
      await tx.done.catch(() => {});
      throw e;
    }

    // Queue every write before awaiting, so the transaction stays active.
    const taskStore = tx.objectStore("tasks");
    const sessionStore = tx.objectStore("sessions");
    const eventStore = tx.objectStore("events");
    const writes: Promise<unknown>[] = [
      ...changes.putTasks.map((t) => taskStore.put(t)),
      ...changes.deleteTaskIds.map((id) => taskStore.delete(id)),
      ...changes.putSessions.map((s) => sessionStore.put(toStored(s))),
      ...changes.addSessions.map((s) => sessionStore.add(toStored(s))),
      ...changes.addEvents.map((e) => eventStore.add(e as TaskEvent)),
    ];
    const addedIds = changes.addTasks.map((t) => taskStore.add(t as StoredTask));
    const [ids] = await Promise.all([Promise.all(addedIds), Promise.all(writes), tx.done]);
    return { result, added: changes.addTasks.map((t, i) => ({ ...t, id: ids[i] })) };
  }
}
