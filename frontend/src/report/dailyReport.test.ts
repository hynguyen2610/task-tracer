import { describe, expect, it } from "vitest";
import { DEFAULT_REPORT_SETTINGS, nextWeekday, withNextWeekday } from "./dailyReport";

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
