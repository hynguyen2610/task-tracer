import { describe, expect, it } from "vitest";
import type { TaskEvent, WorkSession } from "../types";
import { dayRange } from "./dayStats";
import { buildTaskHistory } from "./taskHistory";

const MIN = 60_000;
const HOUR = 60 * MIN;
const day = (d: number) => dayRange(new Date(2026, 10, d)).start;
const at = (d: number, h: number, m = 0) => day(d) + h * HOUR + m * MIN;

let nextId = 1;
const session = (taskId: number, start: number, end: number | null): WorkSession => ({
  id: nextId++,
  taskId,
  taskTitle: `Task ${taskId}`,
  startedAt: start,
  endedAt: end,
});
const event = (e: Partial<TaskEvent> & Pick<TaskEvent, "taskId" | "type" | "at">): TaskEvent => ({
  id: nextId++,
  taskTitle: `Task ${e.taskId}`,
  status: null,
  fromSeconds: null,
  toSeconds: null,
  ...e,
});

describe("buildTaskHistory", () => {
  it("is empty for a task with no history", () => {
    const h = buildTaskHistory({ sessions: [session(2, at(3, 9), at(3, 10))], events: [] }, 1, at(9, 0));
    expect(h.days).toEqual([]);
    expect([h.totalMs, h.firstAt, h.lastAt, h.finishedAt]).toEqual([0, null, null, null]);
  });

  it("groups one task's sessions and events by day, oldest first", () => {
    const h = buildTaskHistory(
      {
        sessions: [
          session(1, at(5, 14), at(5, 15)),
          session(1, at(3, 9), at(3, 10, 30)),
          session(2, at(3, 11), at(3, 12)), // another task
          session(1, at(3, 13), at(3, 14)),
        ],
        events: [
          event({ taskId: 1, type: "status", at: at(3, 9), status: "In progress" }),
          event({ taskId: 1, type: "adjustment", at: at(4, 10), fromSeconds: 9000, toSeconds: 10800 }),
          event({ taskId: 1, type: "status", at: at(5, 15), status: "Done" }),
        ],
      },
      1,
      at(9, 0)
    );
    expect(h.days.map((d) => [d.key, d.totalMs])).toEqual([
      ["2026-11-03", 2.5 * HOUR],
      ["2026-11-04", 30 * MIN], // only an adjustment that day
      ["2026-11-05", HOUR],
    ]);
    expect(h.days[0].entries.map((e) => e.kind)).toEqual(["status", "session", "session"]);
    expect(h.trackedMs).toBe(3.5 * HOUR);
    expect(h.adjustmentMs).toBe(30 * MIN);
    expect(h.totalMs).toBe(4 * HOUR);
    expect([h.firstAt, h.lastAt]).toEqual([at(3, 9), at(5, 15)]);
    expect([h.finishedAt, h.finalStatus]).toEqual([at(5, 15), "Done"]);
  });

  it("isn't finished when it was reopened after Done", () => {
    const h = buildTaskHistory(
      {
        sessions: [],
        events: [
          event({ taskId: 1, type: "status", at: at(3, 9), status: "Done" }),
          event({ taskId: 1, type: "status", at: at(4, 9), status: "In progress" }),
        ],
      },
      1,
      at(9, 0)
    );
    expect([h.finishedAt, h.finalStatus]).toEqual([null, "In progress"]);
  });

  it("splits a session at midnight and counts a running one up to now", () => {
    const h = buildTaskHistory(
      { sessions: [session(1, at(3, 23), at(4, 1)), session(1, at(6, 9), null)], events: [] },
      1,
      at(6, 9, 45)
    );
    expect(h.days.map((d) => [d.key, d.trackedMs])).toEqual([
      ["2026-11-03", HOUR],
      ["2026-11-04", HOUR],
      ["2026-11-06", 45 * MIN],
    ]);
    const running = h.days[2].entries[0];
    expect(running).toMatchObject({ kind: "session", running: true, end: at(6, 9, 45) });
    expect(h.days[0].entries[0]).toMatchObject({ running: false });
    expect(h.lastAt).toBe(at(6, 9, 45));
  });
});
