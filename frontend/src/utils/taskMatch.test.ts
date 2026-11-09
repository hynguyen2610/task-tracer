import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { editDistance, findExactMatch, normalizeTitle, suggestTasks } from "./taskMatch";

let nextId = 1;
const task = (title: string, startedAt: number | null = null): Task => ({
  id: nextId++,
  title,
  totalSeconds: 0,
  isRunning: false,
  priority: "Normal",
  status: "Todo",
  statusNote: null,
  startedAt,
  lastWorkedAt: null,
});

describe("normalizeTitle and editDistance", () => {
  it("ignores case and extra spaces", () => {
    expect(normalizeTitle("  Fix   Login BUG ")).toBe("fix login bug");
  });

  it("counts edits", () => {
    expect(editDistance("bug", "bugs")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
  });
});

describe("findExactMatch", () => {
  it("matches ignoring case and spaces, and prefers the earliest start", () => {
    const tasks = [task("Fix login bug", 2000), task("fix  LOGIN bug", 1000), task("Fix login bug")];
    expect(findExactMatch(tasks, " Fix Login Bug")?.startedAt).toBe(1000);
  });

  it("finds nothing for a new or blank title", () => {
    const tasks = [task("Fix login bug", 1000)];
    expect(findExactMatch(tasks, "Fix login bugs")).toBeUndefined();
    expect(findExactMatch(tasks, "   ")).toBeUndefined();
  });
});

describe("suggestTasks", () => {
  const tasks = [
    task("Review invoices", 5000),
    task("Fix login bug", 1000),
    task("Fix logout bug"),
    task("Write report"),
    task("Fix login bug", 3000), // same title, started later
  ];

  it("ranks exact, then prefix, then contains, then typos", () => {
    // "logout" is 3 edits from "login": too far for a 13-letter title (max 2).
    expect(suggestTasks(tasks, "fix login bug").map((t) => t.title)).toEqual(["Fix login bug"]);
    expect(suggestTasks(tasks, "fix lgoin bug").map((t) => t.title)).toEqual(["Fix login bug"]);
    expect(suggestTasks(tasks, "fix").map((t) => t.title)).toEqual(["Fix login bug", "Fix logout bug"]);
    expect(suggestTasks(tasks, "report").map((t) => t.title)).toEqual(["Write report"]);
    expect(suggestTasks(tasks, "Fix login bugs").map((t) => t.title)).toEqual(["Fix login bug"]);
  });

  it("lists a title once, as its earliest started task", () => {
    const logins = suggestTasks(tasks, "login").filter((t) => t.title === "Fix login bug");
    expect(logins.map((t) => t.startedAt)).toEqual([1000]);
  });

  it("waits for two characters and respects the limit", () => {
    expect(suggestTasks(tasks, "f")).toEqual([]);
    expect(suggestTasks(tasks, "i", 2)).toEqual([]);
    expect(suggestTasks(tasks, "fi", 1)).toHaveLength(1);
  });
});
