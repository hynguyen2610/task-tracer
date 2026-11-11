import { describe, expect, it } from "vitest";
import type { Activity, TaskEvent, WorkSession } from "../types";
import { activeDays, buildDayStats, dayKey, dayRange, MIN_BREAK_MS } from "./dayStats";
import {
  clockToMinutes,
  DEFAULT_WORKDAY,
  minutesToClock,
  workdayError,
  workWindows,
  type WorkdaySettings,
} from "./workday";

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
        session(1, at(14), at(15)), // lunch (not a break), then a 30 min break
      ],
    });
    expect(s.span).toEqual({ start: at(9), end: at(15) });
    expect(s.trackedMs).toBe(4 * HOUR);
    expect(s.breakMs).toBe(30 * MIN);
    expect(s.entries.filter((e) => e.kind === "break")).toEqual([
      { kind: "break", at: at(12), end: at(14), ms: 30 * MIN },
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

describe("breaks and the workday", () => {
  const withWorkday = (sessions: WorkSession[], workday: WorkdaySettings = DEFAULT_WORKDAY) =>
    buildDayStats({ sessions, events: [] }, DAY, NEXT_DAY, NEXT_DAY + HOUR, titles, workday);

  it("uses 08:30–18:00 with lunch 12:00–13:30 by default", () => {
    expect(DEFAULT_WORKDAY).toEqual({ start: 510, lunchStart: 720, lunchEnd: 810, end: 1080 });
  });

  it("doesn't count a gap that is exactly lunch", () => {
    const s = withWorkday([session(1, at(9), at(12)), session(1, at(13, 30), at(17))]);
    expect(s.breakMs).toBe(0);
    expect(s.entries.some((e) => e.kind === "break")).toBe(false);
  });

  it("counts only the parts of a gap around lunch", () => {
    // 11:30–14:00: 30 min before lunch, 30 min after.
    const s = withWorkday([session(1, at(9), at(11, 30)), session(1, at(14), at(17))]);
    expect(s.breakMs).toBe(HOUR);
  });

  it("doesn't count gaps before or after working hours", () => {
    const s = withWorkday([
      session(1, at(7), at(8)), // 08:00–09:00: only 08:30–09:00 counts
      session(1, at(9), at(17, 30)), // 17:30–20:00: only 17:30–18:00 counts
      session(1, at(20), at(21)),
    ]);
    expect(s.breakMs).toBe(HOUR);
    // Work outside working hours still counts in full.
    expect(s.trackedMs).toBe(HOUR + 8.5 * HOUR + HOUR);
    expect(s.workMs).toBe(10.5 * HOUR);
    expect(s.entries.filter((e) => e.kind === "break").map((e) => (e as { ms: number }).ms)).toEqual([
      30 * MIN,
      30 * MIN,
    ]);
  });

  it("follows custom working hours", () => {
    const workday = { start: 9 * 60, lunchStart: 12 * 60, lunchEnd: 13 * 60, end: 17 * 60 };
    const s = withWorkday([session(1, at(10), at(11, 30)), session(1, at(13), at(18))], workday);
    expect(s.breakMs).toBe(30 * MIN); // 11:30–12:00; lunch ends at 13:00
  });
});

describe("workday settings", () => {
  it("rejects times out of order", () => {
    expect(workdayError(DEFAULT_WORKDAY)).toBeNull();
    expect(workdayError({ ...DEFAULT_WORKDAY, end: 500 })).toMatch(/end after/);
    expect(workdayError({ ...DEFAULT_WORKDAY, lunchEnd: 700 })).toMatch(/Lunch must end/);
    expect(workdayError({ ...DEFAULT_WORKDAY, lunchStart: 480 })).toMatch(/inside/);
    // No lunch at all is fine.
    expect(workdayError({ ...DEFAULT_WORKDAY, lunchStart: 720, lunchEnd: 720 })).toBeNull();
  });

  it("converts clock text", () => {
    expect(clockToMinutes("08:30")).toBe(510);
    expect(clockToMinutes("24:00")).toBeNull();
    expect(clockToMinutes("")).toBeNull();
    expect(minutesToClock(810)).toBe("13:30");
  });

  it("splits the day at lunch", () => {
    expect(workWindows(DAY, DEFAULT_WORKDAY)).toEqual([
      { start: at(8, 30), end: at(12) },
      { start: at(13, 30), end: at(18) },
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
