import { describe, expect, it } from "vitest";
import type { Activity, TaskEvent, WorkSession } from "../types";
import { activeDays, buildDayStats, dayKey, dayRange, MIN_BREAK_MS } from "./dayStats";

const MIN = 60_000;
const HOUR = 60 * MIN;
// A fixed local day: 6 Nov 2026.
const { start: DAY, end: NEXT_DAY } = dayRange(new Date(2026, 10, 6));
const at = (h: number, m = 0) => DAY + h * HOUR + m * MIN;

let nextId = 1;
const session = (taskId: number, start: number, end: number | null, title = `Task ${taskId}`): WorkSession => ({
  id: nextId++,
  taskId,
  taskTitle: title,
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
const titles = new Map([
  [1, "Write report"],
  [2, "Fix login bug"],
]);
const stats = (activity: Partial<Activity>, now = NEXT_DAY + HOUR) =>
  buildDayStats({ sessions: [], events: [], ...activity }, DAY, NEXT_DAY, now, titles);

describe("buildDayStats", () => {
  it("is empty for a day with no history", () => {
    const s = stats({});
    expect(s.span).toBeNull();
    expect([s.workMs, s.breakMs, s.entries.length]).toEqual([0, 0, 0]);
  });

  it("adds up work and breaks between sessions", () => {
    const s = stats({
      sessions: [
        session(1, at(9), at(10, 30)),
        session(2, at(10, 30), at(12)), // switch, no gap
        session(1, at(13), at(14)), // 1 h lunch break
      ],
    });
    expect(s.span).toEqual({ start: at(9), end: at(14) });
    expect(s.trackedMs).toBe(4 * HOUR);
    expect(s.breakMs).toBe(HOUR);
    expect(s.entries.filter((e) => e.kind === "break")).toEqual([
      { kind: "break", at: at(12), end: at(13), ms: HOUR },
    ]);
    expect(s.perTask.map((t) => [t.title, t.totalMs])).toEqual([
      ["Write report", 2.5 * HOUR],
      ["Fix login bug", 1.5 * HOUR],
    ]);
  });

  it("counts a gap shorter than the minimum break as work", () => {
    const short = MIN_BREAK_MS - 1;
    const s = stats({
      sessions: [session(1, at(9), at(10)), session(2, at(10) + short, at(11))],
    });
    expect(s.breakMs).toBe(0);
    expect(s.trackedMs).toBe(2 * HOUR);
    expect(s.entries.some((e) => e.kind === "break")).toBe(false);

    const exact = stats({
      sessions: [session(1, at(9), at(10)), session(2, at(10) + MIN_BREAK_MS, at(11))],
    });
    expect(exact.breakMs).toBe(MIN_BREAK_MS);
  });

  it("clips sessions that cross midnight to the day", () => {
    const s = stats({
      sessions: [session(1, DAY - HOUR, at(1)), session(2, at(23), NEXT_DAY + HOUR)],
    });
    expect(s.trackedMs).toBe(2 * HOUR);
    const [first, second] = s.segments;
    expect([first.start, first.fromPreviousDay]).toEqual([DAY, true]);
    expect([second.end, second.intoNextDay]).toEqual([NEXT_DAY, true]);
    // No stop entry for a session that carries on into the next day.
    expect(s.entries.filter((e) => e.kind === "stop")).toHaveLength(1);
  });

  it("counts a running session up to now", () => {
    const s = stats({ sessions: [session(1, at(9), null)] }, at(9, 30));
    expect(s.trackedMs).toBe(30 * MIN);
    expect(s.segments[0].running).toBe(true);
    expect(s.entries.map((e) => e.kind)).toEqual(["start"]);
  });

  it("doesn't double count overlapping sessions", () => {
    const s = stats({ sessions: [session(1, at(9), at(11)), session(2, at(10), at(12))] });
    expect(s.trackedMs).toBe(3 * HOUR);
  });

  it("adds time adjustments made that day to the work total", () => {
    const s = stats({
      sessions: [session(1, at(9), at(10))],
      events: [
        event({ taskId: 1, type: "adjustment", at: at(15), fromSeconds: 3600, toSeconds: 5400 }),
        event({ taskId: 2, type: "adjustment", at: at(16), fromSeconds: 1800, toSeconds: 600 }),
        // Another day's adjustment doesn't count.
        event({ taskId: 1, type: "adjustment", at: NEXT_DAY + 1, fromSeconds: 0, toSeconds: 9999 }),
      ],
    });
    expect(s.adjustmentMs).toBe(30 * MIN - 20 * MIN);
    expect(s.workMs).toBe(HOUR + 10 * MIN);
    const byTitle = Object.fromEntries(s.perTask.map((t) => [t.title, t]));
    expect(byTitle["Write report"].totalMs).toBe(90 * MIN);
    expect(byTitle["Fix login bug"].totalMs).toBe(0); // never below 0
  });

  it("uses current titles and keeps deleted tasks under their stored title", () => {
    const s = stats({
      sessions: [session(1, at(9), at(10), "Old name"), session(7, at(11), at(12), "Gone task")],
    });
    expect(s.segments.map((x) => [x.title, x.deleted])).toEqual([
      ["Write report", false],
      ["Gone task", true],
    ]);
  });

  it("orders a stop, its status change, a break, then a start at the same moment", () => {
    const s = stats({
      sessions: [session(1, at(9), at(10)), session(2, at(10), at(11)), session(1, at(12), at(13))],
      events: [
        event({ taskId: 1, type: "status", at: at(10), status: "Done" }),
        event({ taskId: 2, type: "status", at: at(11), status: "Pending" }),
      ],
    });
    expect(s.entries.map((e) => e.kind)).toEqual([
      "start", "stop", "status", "start", // 10:00 switch
      "stop", "status", "break", // 11:00 stop, Pending, then the break
      "start", "stop",
    ]);
  });
});

describe("activeDays", () => {
  it("marks every day a session touches, and days with adjustments", () => {
    const days = activeDays(
      {
        sessions: [session(1, at(23), NEXT_DAY + HOUR)],
        events: [
          event({ taskId: 1, type: "adjustment", at: DAY + 3 * 24 * HOUR, fromSeconds: 0, toSeconds: 60 }),
          event({ taskId: 1, type: "status", at: DAY + 5 * 24 * HOUR, status: "Done" }),
        ],
      },
      NEXT_DAY + 2 * HOUR
    );
    expect([...days].sort()).toEqual(["2026-11-06", "2026-11-07", "2026-11-09"]);
  });

  it("formats day keys in local time", () => {
    expect(dayKey(at(23, 59))).toBe("2026-11-06");
    expect(dayKey(NEXT_DAY)).toBe("2026-11-07");
  });
});
