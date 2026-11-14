import { describe, expect, it } from "vitest";
import type { Status, TaskChanges } from "../types";
import { MemoryStore } from "./memoryStore";
import { FIRST_TASK_TITLE, TaskError, UNSTARTABLE, type TaskErrorKind } from "./tasks";

// Ported from the Rust tests in src-tauri/src/tasks.rs, so both cores keep
// the same rules. The clock is passed in, so time "passes" by moving `now`.

const T0 = 1_800_000_000_000;

/** A store with the first task (id 1, Todo), like a new database. */
const setup = () => new MemoryStore();
/** Reads a task without adding running time (the clock is before any start). */
const task = (db: MemoryStore, id: number) => db.getTasks(0).find((t) => t.id === id)!;
const set = (status: Status): TaskChanges => ({ status });

function expectError(fn: () => unknown, kind: TaskErrorKind) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(TaskError);
    expect((e as TaskError).kind).toBe(kind);
    return;
  }
  throw new Error(`expected a ${kind} error`);
}

describe("task rules", () => {
  it("new task is Todo and never started", () => {
    const db = setup();
    const t = db.createTask("Write report", "High");
    expect(t.status).toBe("Todo");
    expect(t.position).toBe(1);
    expect([t.startedAt, t.lastWorkedAt]).toEqual([null, null]);
  });

  it("starting a Todo task makes it In progress and stops the other", () => {
    const db = setup();
    db.createTask("Second");
    db.toggleTask(1, T0);
    const tasks = db.toggleTask(2, T0 + 1000);
    const [first, second] = [tasks.find((t) => t.id === 1)!, tasks.find((t) => t.id === 2)!];
    expect([first.isRunning, first.status]).toEqual([false, "In progress"]);
    expect([second.isRunning, second.status]).toEqual([true, "In progress"]);
    expect([second.startedAt, second.lastWorkedAt]).toEqual([T0 + 1000, T0 + 1000]);
    expect(first.totalSeconds).toBe(1);
  });

  it("pausing keeps In progress", () => {
    const db = setup();
    db.toggleTask(1, T0);
    db.toggleTask(1, T0 + 3000);
    const t = task(db, 1);
    expect([t.isRunning, t.status, t.totalSeconds]).toEqual([false, "In progress", 3]);
  });

  it("Pending, Done and Canceled cannot start", () => {
    for (const status of UNSTARTABLE) {
      const db = setup();
      db.updateTask(1, set(status), T0);
      expectError(() => db.toggleTask(1, T0), "conflict");
      expect(() => db.toggleTask(1, T0)).toThrow(`Cannot start a ${status} task`);
    }
  });

  it("leaving In progress stops the timer and keeps elapsed time", () => {
    for (const status of ["Todo", "Pending", "Done", "Canceled"] as Status[]) {
      const db = setup();
      db.toggleTask(1, T0);
      db.updateTask(1, set(status), T0 + 5500);
      const t = task(db, 1);
      expect([t.isRunning, t.status, t.totalSeconds]).toEqual([false, status, 5]);
    }
  });

  it("partial seconds carry over between updates", () => {
    const db = setup();
    db.toggleTask(1, T0);
    // 1.6 s, then another 0.6 s: 2.2 s in total must count as 2, not 1.
    db.getTasks(T0 + 1600);
    const t = db.getTasks(T0 + 2200).find((x) => x.id === 1)!;
    expect(t.totalSeconds).toBe(2);
    expect(t.lastStart).toBe(T0 + 2000);
  });

  it("missing fields keep their value and a title edit isn't work", () => {
    const db = setup();
    db.updateTask(1, { title: "Renamed", priority: undefined, statusNote: null }, T0);
    const t = task(db, 1);
    expect([t.title, t.priority, t.status]).toEqual(["Renamed", "Normal", "Todo"]);
    expect([t.lastWorkedAt, t.startedAt]).toEqual([null, null]);
  });

  it("status note is trimmed, kept, and cleared by an empty string", () => {
    const db = setup();
    db.updateTask(1, { statusNote: "  Waiting for Kiro  " }, T0);
    expect(task(db, 1).statusNote).toBe("Waiting for Kiro");
    db.updateTask(1, set("Pending"), T0);
    expect(task(db, 1).statusNote).toBe("Waiting for Kiro");
    db.updateTask(1, { statusNote: "" }, T0);
    expect(task(db, 1).statusNote).toBeNull();
  });

  it("leaving Todo by hand sets the start date once", () => {
    const db = setup();
    db.updateTask(1, set("Pending"), T0);
    expect(task(db, 1).startedAt).toBe(T0);
    db.updateTask(1, set("Done"), T0 + 60_000);
    expect(task(db, 1).startedAt).toBe(T0);
  });

  it("start date can be set by hand and survives status changes", () => {
    const db = setup();
    db.updateTask(1, { startedAt: 1_700_000_000_000 }, T0);
    let t = task(db, 1);
    expect(t.startedAt).toBe(1_700_000_000_000);
    // Picking a date is not work, and doesn't move the task out of Todo.
    expect([t.lastWorkedAt, t.status]).toEqual([null, "Todo"]);

    db.toggleTask(1, T0);
    db.updateTask(1, set("Done"), T0 + 1000);
    t = task(db, 1);
    expect(t.startedAt).toBe(1_700_000_000_000);

    expectError(() => db.updateTask(1, { startedAt: -1 }, T0), "invalid");
    expectError(() => db.updateTask(1, { startedAt: 1.5 }, T0), "invalid");
  });

  it("invalid status and unknown task are rejected", () => {
    const db = setup();
    expectError(() => db.updateTask(1, { status: "Blocked" as Status }, T0), "invalid");
    expectError(() => db.updateTask(99, set("Done"), T0), "not-found");
    expectError(() => db.toggleTask(99, T0), "not-found");
    expect(() => db.toggleTask(99, T0)).toThrow("Task not found");
  });

  it("reorder and delete", () => {
    const db = setup();
    db.createTask("B");
    db.createTask("C");
    db.reorderTasks([3, 1, 2, 42]);
    expect(db.getTasks(T0).map((t) => t.title)).toEqual(["C", FIRST_TASK_TITLE, "B"]);
    db.deleteTask(1, T0);
    expect(db.getTasks(T0)).toHaveLength(2);
    // A new task still goes to the bottom.
    expect(db.createTask("D").position).toBe(3);
  });

  it("create can reuse a start date", () => {
    const db = setup();
    const t = db.createTask("Again", undefined, 1_700_000_000_000);
    expect([t.status, t.startedAt]).toEqual(["Todo", 1_700_000_000_000]);
    expectError(() => db.createTask("Bad", undefined, -5), "invalid");
  });

  it("each start and stop opens and closes one session", () => {
    const db = setup();
    db.createTask("Second");
    db.toggleTask(1, T0); // start 1
    db.toggleTask(2, T0 + 1000); // start 2, which stops 1
    db.toggleTask(2, T0 + 2000); // pause 2
    db.toggleTask(1, T0 + 3000); // start 1 again
    db.updateTask(1, set("Done"), T0 + 4000); // stops 1

    const { sessions } = db.getActivity(0, Number.MAX_SAFE_INTEGER);
    expect(sessions.map((s) => [s.taskId, s.startedAt, s.endedAt])).toEqual([
      [1, T0, T0 + 1000],
      [2, T0 + 1000, T0 + 2000],
      [1, T0 + 3000, T0 + 4000],
    ]);
    expect(sessions[0].taskTitle).toBe(FIRST_TASK_TITLE);
  });

  it("status changes and time edits are recorded", () => {
    const db = setup();
    db.toggleTask(1, T0); // Todo -> In progress
    db.updateTask(1, set("Pending"), T0);
    db.updateTask(1, { totalSeconds: 1800 }, T0);
    // Unchanged values record nothing.
    db.updateTask(1, { totalSeconds: 1800 }, T0);
    db.updateTask(1, set("Pending"), T0);

    const { events } = db.getActivity(0, Number.MAX_SAFE_INTEGER);
    expect(events.map((e) => [e.type, e.status])).toEqual([
      ["status", "In progress"],
      ["status", "Pending"],
      ["adjustment", null],
    ]);
    expect([events[2].fromSeconds, events[2].toSeconds]).toEqual([0, 1800]);
  });

  it("deleting a task ends its session and keeps its history", () => {
    const db = setup();
    db.toggleTask(1, T0);
    db.deleteTask(1, T0 + 1000);
    const { sessions, events } = db.getActivity(0, Number.MAX_SAFE_INTEGER);
    expect(sessions.map((s) => s.endedAt)).toEqual([T0 + 1000]);
    expect(events).toHaveLength(1);
  });

  it("activity returns sessions overlapping the range", () => {
    const db = setup();
    db.toggleTask(1, 1_000);
    db.toggleTask(1, 5_000);
    db.toggleTask(1, 9_000); // still running

    const starts = (from: number, to: number) => db.getActivity(from, to).sessions.map((s) => s.startedAt);
    expect(starts(4_000, 6_000)).toEqual([1_000]); // overlaps the end
    expect(starts(5_000, 9_000)).toEqual([]); // gap only
    expect(starts(20_000, 30_000)).toEqual([9_000]); // open session runs on
  });
});

describe("the store", () => {
  it("saves nothing when a rule refuses", () => {
    const db = setup();
    db.toggleTask(1, T0);
    const before = structuredClone([db.tasks, db.sessions, db.events]);
    // Bringing the time up to date happens before the refusal; it is undone too.
    expectError(() => db.toggleTask(99, T0 + 5000), "not-found");
    expect([db.tasks, db.sessions, db.events]).toEqual(before);
  });

  it("returns copies, not the stored rows", () => {
    const db = setup();
    db.getTasks(T0)[0].title = "Changed outside";
    expect(task(db, 1).title).toBe(FIRST_TASK_TITLE);
  });
});
