import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { buildReportHtml, buildReportText, DEFAULT_REPORT_SETTINGS, nextWeekday, withNextWeekday } from "./dailyReport";

// November 2026: Mon 9, Tue 10, Wed 11, Thu 12, Fri 13, Sat 14, Sun 15, Mon 16.
const nov = (day: number) => new Date(2026, 10, day, 15, 30);

describe("nextWeekday", () => {
  it("is the next day from Monday to Thursday", () => {
    expect(nextWeekday(nov(9)).getDate()).toBe(10);
    expect(nextWeekday(nov(12)).getDate()).toBe(13);
  });

  it("skips the weekend", () => {
    expect(nextWeekday(nov(13)).getDate()).toBe(16);
    expect(nextWeekday(nov(14)).getDate()).toBe(16);
    expect(nextWeekday(nov(15)).getDate()).toBe(16);
  });

  it("crosses a month end", () => {
    const d = nextWeekday(new Date(2026, 9, 30)); // Fri 30 Oct
    expect([d.getMonth(), d.getDate()]).toEqual([10, 2]);
  });
});

describe("withNextWeekday", () => {
  it("fills the default text with the next weekday", () => {
    expect(withNextWeekday(DEFAULT_REPORT_SETTINGS.nextPlanned, nov(11))).toBe(
      "Thursday:\n- Continue with Onboarding Courses."
    );
    expect(withNextWeekday(DEFAULT_REPORT_SETTINGS.nextPlanned, nov(13))).toMatch(/^Monday:/);
  });

  it("replaces any weekday heading on the first line, in any case", () => {
    expect(withNextWeekday("  friday :\n- a", nov(9))).toBe("  Tuesday :\n- a");
  });

  it("leaves other text alone", () => {
    const texts = ["Tomorrow:\n- a", "- Monday: call", "Finish Monday report", "", "Plan\nMonday:"];
    for (const text of texts) expect(withNextWeekday(text, nov(9))).toBe(text);
  });
});

describe("task lines", () => {
  const task = (overrides: Partial<Task>): Task => ({
    id: 1,
    title: "Fix the login page",
    totalSeconds: 5400,
    isRunning: false,
    priority: "Normal",
    status: "In progress",
    statusNote: null,
    startedAt: nov(9).getTime(),
    lastWorkedAt: nov(11).getTime(),
    etaHours: 8,
    dueAt: new Date(2026, 10, 25).getTime(),
    ...overrides,
  });

  it("keep the original layout: status, start date and ETA (the estimate), nothing else", () => {
    const text = buildReportText(DEFAULT_REPORT_SETTINGS, [task({})], nov(11));
    expect(text).toContain(
      "   o Task #1: Fix the login page\n      - Status : InProgress\n      - Start date : 09 Nov\n      - ETA : 8 hour\n2. Next Planned tasks"
    );
    expect(text).not.toMatch(/Due|Consumed|1\.5 hour/);
    const html = buildReportHtml(DEFAULT_REPORT_SETTINGS, [task({})], nov(11));
    expect(html).toContain("<li>Start date : 09 Nov</li><li>ETA : 8 hour</li></ul>");
    expect(html).not.toMatch(/Due|Consumed/);
  });

  it("show a dash without an ETA", () => {
    const text = buildReportText(DEFAULT_REPORT_SETTINGS, [task({ etaHours: null })], nov(11));
    expect(text).toContain("      - ETA : -\n");
  });
});
