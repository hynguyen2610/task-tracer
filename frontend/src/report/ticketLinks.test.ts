import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { buildReportHtml, buildReportText, DEFAULT_REPORT_SETTINGS } from "./dailyReport";
import { leadingTicket, parseTicketRules, ticketFinder } from "./ticketLinks";

const JIRA = "ABC- https://acme.atlassian.net/browse/{id}";
const REDMINE = "# https://redmine.example.com/issues/{num}";

const find = (rules: string) => ticketFinder(parseTicketRules(rules).rules);

describe("parseTicketRules", () => {
  it("reads prefix and URL per line and reports unusable lines", () => {
    const { rules, invalid } = parseTicketRules(
      `${JIRA}\n\n  ${REDMINE}  \nABC-\nXYZ- ftp://x/{id}\nNOPE- https://x/browse`
    );
    expect(rules).toEqual([
      { prefix: "ABC-", url: "https://acme.atlassian.net/browse/{id}" },
      { prefix: "#", url: "https://redmine.example.com/issues/{num}" },
    ]);
    expect(invalid).toEqual(["ABC-", "XYZ- ftp://x/{id}", "NOPE- https://x/browse"]);
  });
});

describe("ticketFinder", () => {
  it("finds every id and builds its URL and # label", () => {
    const found = find(`${JIRA}\n${REDMINE}`)("Fix ABC-12 and #9257, then abc-3.");
    expect(found.map((t) => [t.id, t.label, t.url])).toEqual([
      ["ABC-12", "#ABC-12", "https://acme.atlassian.net/browse/ABC-12"],
      ["#9257", "#9257", "https://redmine.example.com/issues/9257"],
      ["abc-3", "#abc-3", "https://acme.atlassian.net/browse/abc-3"],
    ]);
  });

  it("includes a # typed before the id in the match", () => {
    const [t] = find(JIRA)("see #ABC-12");
    expect([t.id, t.label, t.index, t.end]).toEqual(["ABC-12", "#ABC-12", 4, 11]);
  });

  it("builds lowercase URLs from {num}", () => {
    const [t] = find("MAIL- https://my.atlassian.net/mail-{num}")("MAIL-1234 Fix");
    expect([t.label, t.url]).toEqual(["#MAIL-1234", "https://my.atlassian.net/mail-1234"]);
  });

  it("ignores ids inside longer words, and prefixes without digits", () => {
    expect(find(JIRA)("XABC-1 ABC- ABC-x my_ABC-2")).toEqual([]);
    expect(find(JIRA)("ABC-1234").map((t) => t.id)).toEqual(["ABC-1234"]);
  });

  it("prefers the longer prefix", () => {
    const f = find("AB- https://a/{id}\nAB-X- https://b/{id}");
    expect(f("AB-X-5 AB-6").map((t) => t.url)).toEqual(["https://b/AB-X-5", "https://a/AB-6"]);
  });

  it("finds nothing without rules", () => {
    expect(find("")("ABC-1")).toEqual([]);
  });
});

describe("leadingTicket", () => {
  it("splits an id at the start of a title", () => {
    const f = find(JIRA);
    expect(leadingTicket("ABC-12: Fix login", f)).toMatchObject({ ticket: { id: "ABC-12" }, rest: "Fix login" });
    expect(leadingTicket("  ABC-12 - Fix login", f)?.rest).toBe("Fix login");
    expect(leadingTicket("Fix ABC-12", f)).toBeNull();
  });
});

describe("report with ticket links", () => {
  const task = (title: string): Task => ({
    id: 1,
    title,
    totalSeconds: 3600,
    isRunning: false,
    priority: "Normal",
    status: "In progress",
    statusNote: "waiting on ABC-7",
    startedAt: null,
    lastWorkedAt: null,
  });
  const settings = {
    ...DEFAULT_REPORT_SETTINGS,
    nextPlanned: "Monday:\n- Continue with ABC-12",
    issues: "Blocked by ABC-9 <urgent>",
    ticketLinks: JIRA,
  };
  const date = new Date(2026, 10, 14);
  const link = (id: string) => `<a href="https://acme.atlassian.net/browse/${id}" style="color:#1155cc;">#${id}</a>`;

  it("links every id in the HTML and heads a task with its own id", () => {
    const html = buildReportHtml(settings, [task("ABC-12 Analyze the mapping"), task("No ticket")], date);
    expect(html).toContain(`Task ${link("ABC-12")}: Analyze the mapping`);
    expect(html).toContain("Task #2: No ticket");
    expect(html).toContain(`(waiting on ${link("ABC-7")})`);
    expect(html).toContain(`Continue with ${link("ABC-12")}`);
    expect(html).toContain(`Blocked by ${link("ABC-9")} &lt;urgent&gt;`);
  });

  it("doesn't double a # typed before an id", () => {
    const html = buildReportHtml(
      { ...settings, nextPlanned: "Continue with task #ABC-12" },
      [task("#ABC-13 Ship it")],
      date
    );
    expect(html).toContain(`Task ${link("ABC-13")}: Ship it`);
    expect(html).toContain(`Continue with task ${link("ABC-12")}`);
    expect(html).not.toContain("##");
  });

  it("shows ids with # in the plain text, without links", () => {
    const text = buildReportText(settings, [task("ABC-12 Analyze the mapping")], date);
    expect(text).toContain("   o Task #ABC-12: Analyze the mapping");
    expect(text).toContain("(waiting on #ABC-7)");
    expect(text).toContain("      - Continue with #ABC-12");
    expect(text).toContain("   Blocked by #ABC-9 <urgent>");
    expect(text).not.toContain("http");
  });

  it("is unchanged without rules", () => {
    const html = buildReportHtml({ ...settings, ticketLinks: "" }, [task("ABC-12 Analyze")], date);
    expect(html).toContain("Task #1: ABC-12 Analyze");
    expect(html).not.toContain("<a ");
  });
});
