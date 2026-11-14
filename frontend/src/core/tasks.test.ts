import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import type { Status, TaskChanges } from "../types";
import { IdbStore } from "./idbStore";
import { MemoryStore } from "./memoryStore";
import { FIRST_TASK_TITLE, TaskError, UNSTARTABLE, type TaskErrorKind } from "./tasks";

// Ported from the Rust tests in src-tauri/src/tasks.rs, so both cores keep
// the same rules. They run against both stores. The clock is passed in, so
// time "passes" by moving `now`.

const T0 = 1_800_000_000_000;
const ALL_TIME = [0, Number.MAX_SAFE_INTEGER] as const;
const set = (status: Status): TaskChanges => ({ status });

type Store = MemoryStore | IdbStore;

async function expectError(fn: () => unknown, kind: TaskErrorKind, message?: string) {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(TaskError);
    expect((e as TaskError).kind).toBe(kind);
    if (message) expect((e as TaskError).message).toBe(message);
    return;
  }
  throw new Error(`expected a ${kind} error`);
}

let dbCount = 0;
const opened: IdbStore[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

const stores: [string, () => Promise<Store>][] = [
  ["memory", async () => new MemoryStore()],
  [
    "IndexedDB",
    async () => {
      const db = await IdbStore.open(`test-${dbCount++}`);
      opened.push(db);
      return db;
    },
  ],
];

describe.each(stores)("task rules (%s store)", (_name, open) => {
  /** A store with the first task (id 1, Todo), like a new database. */
  const setup = open;
  /** Reads a task without adding running time (the clock is before any start). */
  const task = async (db: Store, id: number) => (await db.getTasks(0)).find((t) => t.id === id)!;

  it("new task is Todo and never started", async () => {
    const db = await setup();
    const t = await db.createTask("Write report", "High");
    expect([t.id, t.title, t.priority, t.status]).toEqual([2, "Write report", "High", "Todo"]);
    expect(t.position).toBe(1);
    expect([t.startedAt, t.lastWorkedAt]).toEqual([null, null]);
  });

  it("starting a Todo task makes it In progress and stops the other", async () => {
    const db = await setup();
    await db.createTask("Second");
    await db.toggleTask(1, T0);
    const tasks = await db.toggleTask(2, T0 + 1000);
    const [first, second] = [tasks.find((t) => t.id === 1)!, tasks.find((t) => t.id === 2)!];
    expect([first.isRunning, first.status]).toEqual([false, "In progress"]);
    expect([second.isRunning, second.status]).toEqual([true, "In progress"]);
    expect([second.startedAt, second.lastWorkedAt]).toEqual([T0 + 1000, T0 + 1000]);
    expect(first.totalSeconds).toBe(1);
  });

  it("pausing keeps In progress", async () => {
    const db = await setup();
    await db.toggleTask(1, T0);
    await db.toggleTask(1, T0 + 3000);
    const t = await task(db, 1);
    expect([t.isRunning, t.status, t.totalSeconds]).toEqual([false, "In progress", 3]);
  });

  it("Pending, Done and Canceled cannot start", async () => {
    for (const status of UNSTARTABLE) {
      const db = await setup();
      await db.updateTask(1, set(status), T0);
      await expectError(() => db.toggleTask(1, T0), "conflict", `Cannot start a ${status} task`);
    }
  });

  it("leaving In progress stops the timer and keeps elapsed time", async () => {
    for (const status of ["Todo", "Pending", "Done", "Canceled"] as Status[]) {
      const db = await setup();
      await db.toggleTask(1, T0);
      await db.updateTask(1, set(status), T0 + 5500);
      const t = await task(db, 1);
      expect([t.isRunning, t.status, t.totalSeconds]).toEqual([false, status, 5]);
    }
  });

  it("partial seconds carry over between updates", async () => {
    const db = await setup();
    await db.toggleTask(1, T0);
    // 1.6 s, then another 0.6 s: 2.2 s in total must count as 2, not 1.
    await db.getTasks(T0 + 1600);
    const t = (await db.getTasks(T0 + 2200)).find((x) => x.id === 1)!;
    expect(t.totalSeconds).toBe(2);
    expect(t.lastStart).toBe(T0 + 2000);
  });

  it("missing fields keep their value and a title edit isn't work", async () => {
    const db = await setup();
    await db.updateTask(1, { title: "Renamed", priority: undefined, statusNote: null }, T0);
    const t = await task(db, 1);
    expect([t.title, t.priority, t.status]).toEqual(["Renamed", "Normal", "Todo"]);
    expect([t.lastWorkedAt, t.startedAt]).toEqual([null, null]);
  });

  it("status note is trimmed, kept, and cleared by an empty string", async () => {
    const db = await setup();
    await db.updateTask(1, { statusNote: "  Waiting for Kiro  " }, T0);
    expect((await task(db, 1)).statusNote).toBe("Waiting for Kiro");
    await db.updateTask(1, set("Pending"), T0);
    expect((await task(db, 1)).statusNote).toBe("Waiting for Kiro");
    await db.updateTask(1, { statusNote: "" }, T0);
    expect((await task(db, 1)).statusNote).toBeNull();
  });

  it("leaving Todo by hand sets the start date once", async () => {
    const db = await setup();
    await db.updateTask(1, set("Pending"), T0);
    expect((await task(db, 1)).startedAt).toBe(T0);
    await db.updateTask(1, set("Done"), T0 + 60_000);
    expect((await task(db, 1)).startedAt).toBe(T0);
  });

  it("start date can be set by hand and survives status changes", async () => {
    const db = await setup();
    await db.updateTask(1, { startedAt: 1_700_000_000_000 }, T0);
    let t = await task(db, 1);
    expect(t.startedAt).toBe(1_700_000_000_000);
    // Picking a date is not work, and doesn't move the task out of Todo.
    expect([t.lastWorkedAt, t.status]).toEqual([null, "Todo"]);

    await db.toggleTask(1, T0);
    await db.updateTask(1, set("Done"), T0 + 1000);
    t = await task(db, 1);
    expect(t.startedAt).toBe(1_700_000_000_000);

    await expectError(() => db.updateTask(1, { startedAt: -1 }, T0), "invalid");
    await expectError(() => db.updateTask(1, { startedAt: 1.5 }, T0), "invalid");
  });

  it("invalid status and unknown task are rejected", async () => {
    const db = await setup();
    await expectError(() => db.updateTask(1, { status: "Blocked" as Status }, T0), "invalid");
    await expectError(() => db.updateTask(99, set("Done"), T0), "not-found");
    await expectError(() => db.toggleTask(99, T0), "not-found", "Task not found");
  });

  it("reorder and delete", async () => {
    const db = await setup();
    await db.createTask("B");
    await db.createTask("C");
    await db.reorderTasks([3, 1, 2, 42]);
    expect((await db.getTasks(T0)).map((t) => t.title)).toEqual(["C", FIRST_TASK_TITLE, "B"]);
    await db.deleteTask(1, T0);
    expect(await db.getTasks(T0)).toHaveLength(2);
    // A new task still goes to the bottom.
    expect((await db.createTask("D")).position).toBe(3);
  });

  it("create can reuse a start date", async () => {
    const db = await setup();
    const t = await db.createTask("Again", undefined, 1_700_000_000_000);
    expect([t.status, t.startedAt]).toEqual(["Todo", 1_700_000_000_000]);
    await expectError(() => db.createTask("Bad", undefined, -5), "invalid");
  });

  it("each start and stop opens and closes one session", async () => {
    const db = await setup();
    await db.createTask("Second");
    await db.toggleTask(1, T0); // start 1
    await db.toggleTask(2, T0 + 1000); // start 2, which stops 1
    await db.toggleTask(2, T0 + 2000); // pause 2
    await db.toggleTask(1, T0 + 3000); // start 1 again
    await db.updateTask(1, set("Done"), T0 + 4000); // stops 1

    const { sessions } = await db.getActivity(...ALL_TIME);
    expect(sessions.map((s) => [s.taskId, s.startedAt, s.endedAt])).toEqual([
      [1, T0, T0 + 1000],
      [2, T0 + 1000, T0 + 2000],
      [1, T0 + 3000, T0 + 4000],
    ]);
    expect(sessions[0]).toEqual({ id: 1, taskId: 1, taskTitle: FIRST_TASK_TITLE, startedAt: T0, endedAt: T0 + 1000 });
  });

  it("status changes and time edits are recorded", async () => {
    const db = await setup();
    await db.toggleTask(1, T0); // Todo -> In progress
    await db.updateTask(1, set("Pending"), T0);
    await db.updateTask(1, { totalSeconds: 1800 }, T0);
    // Unchanged values record nothing.
    await db.updateTask(1, { totalSeconds: 1800 }, T0);
    await db.updateTask(1, set("Pending"), T0);

    const { events } = await db.getActivity(...ALL_TIME);
    expect(events.map((e) => [e.type, e.status])).toEqual([
      ["status", "In progress"],
      ["status", "Pending"],
      ["adjustment", null],
    ]);
    expect([events[2].fromSeconds, events[2].toSeconds]).toEqual([0, 1800]);
  });

  it("deleting a task ends its session and keeps its history", async () => {
    const db = await setup();
    await db.toggleTask(1, T0);
    await db.deleteTask(1, T0 + 1000);
    const { sessions, events } = await db.getActivity(...ALL_TIME);
    expect(sessions.map((s) => s.endedAt)).toEqual([T0 + 1000]);
    expect(events).toHaveLength(1);
  });

  it("activity returns sessions overlapping the range", async () => {
    const db = await setup();
    await db.toggleTask(1, 1_000);
    await db.toggleTask(1, 5_000);
    await db.toggleTask(1, 9_000); // still running

    const starts = async (from: number, to: number) =>
      (await db.getActivity(from, to)).sessions.map((s) => s.startedAt);
    expect(await starts(4_000, 6_000)).toEqual([1_000]); // overlaps the end
    expect(await starts(5_000, 9_000)).toEqual([]); // gap only
    expect(await starts(20_000, 30_000)).toEqual([9_000]); // open session runs on
  });

  it("saves nothing when a rule refuses", async () => {
    const db = await setup();
    await db.toggleTask(1, T0);
    // Bringing the time up to date happens before the refusal; it is undone too.
    await expectError(() => db.toggleTask(99, T0 + 5000), "not-found");
    expect((await task(db, 1)).totalSeconds).toBe(0);
  });

  it("returns copies, not the stored rows", async () => {
    const db = await setup();
    (await db.getTasks(T0))[0].title = "Changed outside";
    expect((await task(db, 1)).title).toBe(FIRST_TASK_TITLE);
  });
});

describe("IndexedDB store", () => {
  it("keeps data after reopening, and seeds only a new database", async () => {
    const name = `test-${dbCount++}`;
    const first = await IdbStore.open(name);
    await first.createTask("Kept");
    await first.toggleTask(2, T0);
    first.close();

    const again = await IdbStore.open(name);
    opened.push(again);
    expect((await again.getTasks(T0)).map((t) => [t.title, t.isRunning])).toEqual([
      [FIRST_TASK_TITLE, false],
      ["Kept", true],
    ]);
    // The running session is still found as open, and closes on pause.
    await again.toggleTask(2, T0 + 2000);
    const { sessions } = await again.getActivity(...ALL_TIME);
    expect(sessions).toEqual([{ id: 1, taskId: 2, taskTitle: "Kept", startedAt: T0, endedAt: T0 + 2000 }]);
  });

  it("serialises calls, so concurrent polls add running time once", async () => {
    const db = await IdbStore.open(`test-${dbCount++}`);
    opened.push(db);
    await db.toggleTask(1, T0);
    await Promise.all([db.getTasks(T0 + 3000), db.getTasks(T0 + 3000), db.getTasks(T0 + 3000)]);
    expect((await db.getTasks(T0 + 3000))[0].totalSeconds).toBe(3);
  });
});
