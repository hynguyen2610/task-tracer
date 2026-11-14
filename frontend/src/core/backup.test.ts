import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { backupFileName, makeBackup, parseBackup, type Backup } from "./backup";
import { IdbStore } from "./idbStore";

const T0 = 1_800_000_000_000;
let dbCount = 0;
const open = () => IdbStore.open(`backup-test-${dbCount++}`);

const valid = (): Backup =>
  makeBackup(
    {
      tasks: [
        {
          id: 3,
          title: "Write report",
          totalSeconds: 60,
          isRunning: false,
          lastStart: null,
          position: 0,
          priority: "High",
          status: "In progress",
          statusNote: null,
          startedAt: T0,
          lastWorkedAt: T0,
        },
      ],
      sessions: [{ id: 1, taskId: 3, taskTitle: "Write report", startedAt: T0, endedAt: T0 + 60_000 }],
      events: [
        { id: 1, taskId: 3, taskTitle: "Write report", type: "status", at: T0, status: "In progress", fromSeconds: null, toSeconds: null },
      ],
    },
    { timeFormat: "decimal" },
    T0
  );

/** `valid()` with one change, as JSON text. */
const withChange = (change: (b: Record<string, unknown>) => void) => {
  const b = JSON.parse(JSON.stringify(valid()));
  change(b);
  return JSON.stringify(b);
};

describe("backup", () => {
  it("round-trips through a file into another database, keeping ids", async () => {
    const source = await open();
    await source.createTask("Second", "Low");
    await source.toggleTask(2, T0);
    await source.updateTask(2, { totalSeconds: 3600 }, T0);
    const file = JSON.stringify(makeBackup(await source.exportData(), { workday: "{}" }, T0 + 6000));
    source.close();

    const target = await open();
    await target.createTask("Replaced");
    const backup = parseBackup(file);
    expect(backup.settings).toEqual({ workday: "{}" });
    await target.replaceAll(backup);

    const tasks = await target.getTasks(T0 + 6000);
    expect(tasks.map((t) => [t.id, t.title, t.isRunning])).toEqual([
      [1, "First task of the day", false],
      [2, "Second", true],
    ]);
    // The running task keeps counting from where the backup left it.
    expect(tasks[1].totalSeconds).toBe(3606);
    const { sessions, events } = await target.getActivity(0, T0 + 10_000);
    expect(sessions).toEqual([{ id: 1, taskId: 2, taskTitle: "Second", startedAt: T0, endedAt: null }]);
    expect(events.map((e) => e.type)).toEqual(["status", "adjustment"]);

    // New rows get ids after the imported ones, and the open session closes.
    expect((await target.createTask("Next")).id).toBe(3);
    await target.toggleTask(2, T0 + 7000);
    expect((await target.getActivity(0, T0 + 10_000)).sessions[0].endedAt).toBe(T0 + 7000);
    target.close();
  });

  it("accepts rows as tasks.db stores them", () => {
    const text = withChange((b) => {
      const t = (b.tasks as Record<string, unknown>[])[0];
      Object.assign(t, { isRunning: 1, lastStart: T0, position: null });
      delete t.statusNote;
    });
    const task = parseBackup(text).tasks[0];
    expect([task.isRunning, task.position, task.statusNote]).toEqual([true, 0, null]);
  });

  it("doesn't let a task run without a start time", () => {
    const text = withChange((b) => Object.assign((b.tasks as object[])[0], { isRunning: true, lastStart: null }));
    expect(parseBackup(text).tasks[0].isRunning).toBe(false);
  });

  it("ignores settings it doesn't know", () => {
    const text = withChange((b) => (b.settings = { timeFormat: "hhmm", other: "x", workday: 5 }));
    expect(parseBackup(text).settings).toEqual({ timeFormat: "hhmm" });
  });

  it.each([
    ["not JSON", "{", "isn't JSON"],
    ["another file", JSON.stringify({ hello: 1 }), "isn't a Task Tracker backup"],
    ["a newer version", withChange((b) => (b.version = 2)), "version 2 isn't supported"],
    ["a missing list", withChange((b) => delete b.events), "no events list"],
    ["a bad field", withChange((b) => ((b.tasks as Record<string, unknown>[])[0].title = 5)), "Task 1: title must be text"],
    ["an unknown status", withChange((b) => ((b.tasks as Record<string, unknown>[])[0].status = "Blocked")), "Task 1: status must be one of"],
    ["a repeated id", withChange((b) => (b.sessions = [...(b.sessions as object[]), ...(b.sessions as object[])])), "Two sessions have id 1"],
    [
      "two running tasks",
      withChange((b) => {
        const t = (b.tasks as Record<string, unknown>[])[0];
        Object.assign(t, { isRunning: true, lastStart: T0 });
        b.tasks = [t, { ...t, id: 4 }];
      }),
      "More than one task is running",
    ],
    [
      "a session ending before it starts",
      withChange((b) => ((b.sessions as Record<string, unknown>[])[0].endedAt = T0 - 1)),
      "Session 1 ends before it starts",
    ],
  ])("rejects %s", (_name, text, message) => {
    expect(() => parseBackup(text)).toThrow(message);
  });

  it("names the file after the local day", () => {
    expect(backupFileName(new Date(2026, 10, 4, 23, 59).getTime())).toBe("task-tracker-backup-2026-11-04.json");
  });
});
