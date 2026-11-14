import type { Status, Task } from "../types";
import {
  leadingTicket,
  parseTicketRules,
  replaceTickets,
  ticketFinder,
  type TicketMatch,
} from "./ticketLinks";

/** The editable email text around the task list. */
export interface ReportSettings {
  greeting: string;
  /** "{date}" is replaced with the report date, e.g. "06 Nov". */
  intro: string;
  /** One item per line; a line starting with "-" is a sub-item of the line above. */
  nextPlanned: string;
  issues: string;
  signature: string;
  /** One rule per line: ticket prefix, then URL with {id} or {num}. See ticketLinks.ts. */
  ticketLinks: string;
}

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  greeting: "Dear a.Duy and a.An,",
  intro: "I would like to submit my daily work report for {date}",
  nextPlanned: "Monday:\n- Continue with Onboarding Courses.",
  issues: "None",
  signature: "Best regards,\nHy",
  ticketLinks: "",
};

const STATUS_LABELS: Record<Status, string> = {
  Todo: "Todo",
  "In progress": "In progress",
  Pending: "Pending",
  Done: "Done",
  Canceled: "CANCELLED",
};

/** Highlight colors for the status word, as used in the email. */
const STATUS_HIGHLIGHTS: Partial<Record<Status, string>> = {
  "In progress": "#9fc5e8",
  Pending: "#ffc000",
  Done: "#00ff00",
  Canceled: "#ff99cc",
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Tasks for the report on `day`: anything worked on that day (time tracked,
 * time edited or status changed), plus every task still In progress or
 * Pending. Keeps list order.
 */
export function selectReportTasks(tasks: Task[], day: Date): Task[] {
  return tasks.filter(
    (t) =>
      t.status === "In progress" ||
      t.status === "Pending" ||
      (t.lastWorkedAt !== null && isSameDay(new Date(t.lastWorkedAt), day))
  );
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The next Monday–Friday after `date`: Friday, Saturday and Sunday give Monday. */
export function nextWeekday(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  return next;
}

/**
 * Sets a weekday heading on the first line of the planned tasks (e.g.
 * "Monday:") to the next weekday after `today`. Other text is left alone.
 */
export function withNextWeekday(nextPlanned: string, today: Date): string {
  const day = WEEKDAYS[nextWeekday(today).getDay()];
  return nextPlanned.replace(
    new RegExp(`^(\\s*)(${WEEKDAYS.join("|")})(\\s*:)`, "i"),
    (_, lead: string, _old: string, colon: string) => `${lead}${day}${colon}`
  );
}

/** 6 Nov 2026 -> "06 Nov" */
export function formatReportDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

/** Tracked time rounded to the nearest quarter hour, never 0 once time is tracked. */
export function roundedHours(totalSeconds: number): number {
  const hours = Math.round(totalSeconds / 900) / 4;
  return hours === 0 && totalSeconds > 0 ? 0.25 : hours;
}

export function formatEta(totalSeconds: number): string {
  return `${roundedHours(totalSeconds)} hour`;
}

/** Sum of the ETAs shown in the report, so it matches what the reader adds up. */
export function totalRoundedHours(tasks: Task[]): number {
  return tasks.reduce((sum, t) => sum + roundedHours(t.totalSeconds), 0);
}

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "");

interface PlannedItem {
  text: string;
  children: string[];
}

function parsePlanned(text: string): PlannedItem[] {
  const items: PlannedItem[] = [];
  for (const line of lines(text)) {
    const sub = line.trimStart().match(/^[-*]\s*(.*)$/);
    if (sub && items.length > 0) items[items.length - 1].children.push(sub[1]);
    else items.push({ text: sub ? sub[1] : line.trim(), children: [] });
  }
  return items;
}

function taskFacts(task: Task) {
  return {
    status: STATUS_LABELS[task.status],
    note: task.statusNote ? ` (${task.statusNote})` : "",
    start: task.startedAt ? formatReportDate(new Date(task.startedAt)) : "-",
    eta: formatEta(task.totalSeconds),
  };
}

// ---- HTML (pasted into email, so inline styles only) ----

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const ul = (type: "circle" | "square", items: string[]) =>
  `<ul style="list-style-type:${type};margin:0;">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

const findTickets = (settings: ReportSettings) =>
  ticketFinder(parseTicketRules(settings.ticketLinks).rules);

/**
 * "Task #2: Fix login", or "Task #ABC-12: Fix login" when the title starts
 * with a ticket id (the id then isn't repeated in the title).
 */
function taskHeading(task: Task, find: (text: string) => TicketMatch[]) {
  const lead = leadingTicket(task.title, find);
  return lead ? { ticket: lead.ticket, title: lead.rest } : { ticket: null, title: task.title };
}

const linkHtml = (t: TicketMatch) =>
  `<a href="${escapeHtml(t.url)}" style="color:#1155cc;">${escapeHtml(t.label)}</a>`;

export function buildReportHtml(settings: ReportSettings, tasks: Task[], date: Date): string {
  const find = findTickets(settings);
  /** Escaped text with every ticket id as a link. */
  const rich = (text: string) => replaceTickets(text, find, linkHtml, escapeHtml);
  const htmlLines = (text: string) => lines(text).map(rich).join("<br>");

  const taskItems = tasks.map((task, i) => {
    const f = taskFacts(task);
    const color = STATUS_HIGHLIGHTS[task.status];
    const status = color
      ? `<span style="background-color:${color};">${escapeHtml(f.status)}</span>`
      : escapeHtml(f.status);
    const heading = taskHeading(task, find);
    const label = heading.ticket ? `Task ${linkHtml(heading.ticket)}` : `Task #${i + 1}`;
    return (
      `${label}: ${rich(heading.title)}` +
      ul("square", [
        `Status : ${status}${rich(f.note)}`,
        `Start date : ${f.start}`,
        `ETA : ${f.eta}`,
      ])
    );
  });

  const planned = parsePlanned(settings.nextPlanned).map(
    (item) =>
      rich(item.text) +
      (item.children.length ? ul("square", item.children.map(rich)) : "")
  );

  const intro = settings.intro.replace("{date}", formatReportDate(date));

  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;">` +
    `<p>${htmlLines(settings.greeting)}<br>${htmlLines(intro)}</p>` +
    `<ol>` +
    `<li>Task in Review/Task in Progress${ul("circle", taskItems.length ? taskItems : ["None"])}</li>` +
    `<li>Next Planned tasks${ul("circle", planned.length ? planned : ["None"])}</li>` +
    `<li>Issue/Concerns/Blocks<div>${htmlLines(settings.issues) || "None"}</div></li>` +
    `</ol>` +
    `<p>${htmlLines(settings.signature)}</p>` +
    `</div>`
  );
}

// ---- Plain text (for mail clients that drop formatting) ----

export function buildReportText(settings: ReportSettings, tasks: Task[], date: Date): string {
  const find = findTickets(settings);
  /** Ticket ids shown as "#ABC-12", like the HTML version, but not linked. */
  const plain = (text: string) => replaceTickets(text, find, (t) => t.label);
  const plainLines = (text: string) => lines(text).map(plain);

  const out: string[] = [];
  out.push(...plainLines(settings.greeting));
  out.push(...plainLines(settings.intro.replace("{date}", formatReportDate(date))), "");

  out.push("1. Task in Review/Task in Progress");
  if (tasks.length === 0) out.push("   o None");
  tasks.forEach((task, i) => {
    const f = taskFacts(task);
    const heading = taskHeading(task, find);
    out.push(
      `   o Task ${heading.ticket ? heading.ticket.label : `#${i + 1}`}: ${plain(heading.title)}`,
      `      - Status : ${f.status}${plain(f.note)}`,
      `      - Start date : ${f.start}`,
      `      - ETA : ${f.eta}`
    );
  });

  out.push("2. Next Planned tasks");
  const planned = parsePlanned(settings.nextPlanned);
  if (planned.length === 0) out.push("   o None");
  planned.forEach((item) => {
    out.push(`   o ${plain(item.text)}`);
    item.children.forEach((c) => out.push(`      - ${plain(c)}`));
  });

  out.push("3. Issue/Concerns/Blocks");
  const issues = plainLines(settings.issues);
  out.push(...(issues.length ? issues : ["None"]).map((l) => `   ${l.trim()}`), "");

  out.push(...plainLines(settings.signature));
  return out.join("\n");
}
