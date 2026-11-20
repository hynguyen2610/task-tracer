import { describe, expect, it } from "vitest";
import type { Status } from "../types";
import { dueProgress } from "./dueProgress";

// Local dates, as the app uses them.
const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).getTime();
const task = (startedAt: number | null, dueAt: number | null, status: Status = "In progress") => ({
  startedAt,
  dueAt,
  status,
});

describe("dueProgress", () => {
  it("is nothing without a due date, or once the task is finished", () => {
    expect(dueProgress(task(at(2026, 11, 1), null), at(2026, 11, 5))).toBeNull();
    expect(dueProgress(task(at(2026, 11, 1), at(2026, 11, 10), "Done"), at(2026, 11, 5))).toBeNull();
    expect(dueProgress(task(at(2026, 11, 1), at(2026, 11, 10), "Canceled"), at(2026, 11, 5))).toBeNull();
  });

  it("runs from the start of the start date to the end of the due date", () => {
    // 1 Nov 00:00 to 10 Nov 24:00 is 10 days; noon on 3 Nov is 2.5 days in.
    const p = dueProgress(task(at(2026, 11, 1, 9), at(2026, 11, 10)), at(2026, 11, 3, 12))!;
    expect(p.fraction).toBeCloseTo(0.25);
    expect(p).toMatchObject({ tone: "ok", label: "7 days left" });
  });

  it("is due soon from 75% of the time, and on the due date itself", () => {
    expect(dueProgress(task(at(2026, 11, 1), at(2026, 11, 10)), at(2026, 11, 8, 12))).toMatchObject({
      tone: "soon",
      label: "2 days left",
    });
    expect(dueProgress(task(at(2026, 11, 1), at(2026, 11, 10)), at(2026, 11, 9, 12))!.label).toBe("1 day left");
    expect(dueProgress(task(at(2026, 11, 1), at(2026, 11, 10)), at(2026, 11, 10, 17))).toMatchObject({
      tone: "soon",
      label: "Due today",
    });
  });

  it("is late after the due date, with the bar full", () => {
    expect(dueProgress(task(at(2026, 11, 1), at(2026, 11, 10)), at(2026, 11, 12, 9))).toEqual({
      fraction: 1,
      tone: "late",
      label: "Overdue by 2 days",
    });
    expect(dueProgress(task(at(2026, 11, 1), at(2026, 11, 10)), at(2026, 11, 11, 0))!.label).toBe("Overdue by 1 day");
  });

  it("a due date before the start date is simply late or due", () => {
    expect(dueProgress(task(at(2026, 11, 10), at(2026, 11, 5)), at(2026, 11, 10, 9))).toMatchObject({
      fraction: 1,
      tone: "late",
    });
  });

  it("shows only the days for a task not started yet", () => {
    expect(dueProgress(task(null, at(2026, 11, 10), "Todo"), at(2026, 11, 7))).toEqual({
      fraction: null,
      tone: "ok",
      label: "Due in 3 days",
    });
    expect(dueProgress(task(null, at(2026, 11, 10), "Todo"), at(2026, 11, 10, 8))).toMatchObject({
      tone: "soon",
      label: "Due today",
    });
    expect(dueProgress(task(null, at(2026, 11, 10), "Todo"), at(2026, 11, 11))).toMatchObject({
      tone: "late",
      label: "Overdue by 1 day",
    });
  });
});
