import type { Priority, Status, TaskEvent, WorkSession } from "../types";
import { STATUSES, type StoredTask } from "./tasks";

// A whole database, plus the settings kept in localStorage, as one JSON file.
// See docs/SPEC.md 10.3. backend/scripts/export-json.js writes the same
// format from a tasks.db.

export const BACKUP_FORMAT = "task-tracker-backup";
export const BACKUP_VERSION = 1;

/** The localStorage settings a backup carries, kept as their stored text. */
export const SETTING_KEYS = ["timeFormat", "dailyReportSettings", "workday"] as const;

export interface BackupData {
  tasks: StoredTask[];
  sessions: WorkSession[];
  events: TaskEvent[];
}

export interface Backup extends BackupData {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  /** Epoch ms. */
  exportedAt: number;
  settings: Record<string, string>;
}

export function makeBackup(data: BackupData, settings: Record<string, string>, now: number): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, ...data, settings };
}

/** "task-tracker-backup-2026-11-14.json", in local time. */
export function backupFileName(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${BACKUP_FORMAT}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** The file can't be imported; `message` says why. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

const PRIORITIES: Priority[] = ["Highest", "High", "Normal", "Low"];

type Row = Record<string, unknown>;

/** Reads fields of one row, failing with the row's place in the file. */
function reader(row: unknown, where: string) {
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new BackupError(`${where} isn't an object.`);
  const r = row as Row;
  const fail = (field: string, what: string): never => {
    throw new BackupError(`${where}: ${field} must be ${what}.`);
  };
  const int = (field: string): number => {
    const v = r[field];
    return typeof v === "number" && Number.isInteger(v) ? v : fail(field, "a whole number");
  };
  const optInt = (field: string): number | null => (r[field] === undefined || r[field] === null ? null : int(field));
  const str = (field: string): string => (typeof r[field] === "string" ? (r[field] as string) : fail(field, "text"));
  const optStr = (field: string): string | null => (r[field] === undefined || r[field] === null ? null : str(field));
  const oneOf = <T extends string>(field: string, values: readonly T[], fallback?: T): T => {
    const v = r[field] ?? fallback;
    return values.includes(v as T) ? (v as T) : fail(field, `one of ${values.join(", ")}`);
  };
  const bool = (field: string): boolean => {
    const v = r[field] ?? false;
    // tasks.db stores booleans as 0 and 1.
    if (v === true || v === 1) return true;
    if (v === false || v === 0) return false;
    return fail(field, "true or false");
  };
  return { int, optInt, str, optStr, oneOf, bool };
}

function list(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new BackupError(`The file has no ${name} list.`);
  return value;
}

function uniqueIds<T extends { id: number }>(rows: T[], name: string): T[] {
  const seen = new Set<number>();
  for (const row of rows) {
    if (row.id < 1) throw new BackupError(`${name} id ${row.id} must be 1 or more.`);
    if (seen.has(row.id)) throw new BackupError(`Two ${name} have id ${row.id}.`);
    seen.add(row.id);
  }
  return rows;
}

/** Checks a backup file and returns its contents, or throws a BackupError. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("The file isn't JSON.");
  }
  if (!raw || typeof raw !== "object" || (raw as Row).format !== BACKUP_FORMAT) {
    throw new BackupError("This isn't a Task Tracker backup.");
  }
  const top = raw as Row;
  if (top.version !== BACKUP_VERSION) {
    throw new BackupError(`Backup version ${String(top.version)} isn't supported; update the app.`);
  }

  const tasks = uniqueIds(
    list(top.tasks, "tasks").map((row, i): StoredTask => {
      const r = reader(row, `Task ${i + 1}`);
      const isRunning = r.bool("isRunning");
      const lastStart = r.optInt("lastStart");
      return {
        id: r.int("id"),
        title: r.str("title"),
        totalSeconds: Math.max(0, r.int("totalSeconds")),
        // A running task needs to know since when.
        isRunning: isRunning && lastStart !== null,
        lastStart,
        position: r.optInt("position") ?? i,
        priority: r.oneOf("priority", PRIORITIES, "Normal"),
        status: r.oneOf("status", STATUSES, "Todo"),
        statusNote: r.optStr("statusNote"),
        startedAt: r.optInt("startedAt"),
        lastWorkedAt: r.optInt("lastWorkedAt"),
      };
    }),
    "tasks"
  );
  if (tasks.filter((t) => t.isRunning).length > 1) throw new BackupError("More than one task is running.");

  const sessions = uniqueIds(
    list(top.sessions, "sessions").map((row, i): WorkSession => {
      const r = reader(row, `Session ${i + 1}`);
      const s = {
        id: r.int("id"),
        taskId: r.int("taskId"),
        taskTitle: r.str("taskTitle"),
        startedAt: r.int("startedAt"),
        endedAt: r.optInt("endedAt"),
      };
      if (s.endedAt !== null && s.endedAt < s.startedAt) {
        throw new BackupError(`Session ${i + 1} ends before it starts.`);
      }
      return s;
    }),
    "sessions"
  );

  const events = uniqueIds(
    list(top.events, "events").map((row, i): TaskEvent => {
      const r = reader(row, `Event ${i + 1}`);
      const type = r.oneOf("type", ["status", "adjustment"] as const);
      return {
        id: r.int("id"),
        taskId: r.int("taskId"),
        taskTitle: r.str("taskTitle"),
        type,
        at: r.int("at"),
        status: type === "status" ? r.oneOf<Status>("status", STATUSES) : null,
        fromSeconds: type === "adjustment" ? r.int("fromSeconds") : null,
        toSeconds: type === "adjustment" ? r.int("toSeconds") : null,
      };
    }),
    "events"
  );

  const settings: Record<string, string> = {};
  const rawSettings = top.settings;
  if (rawSettings && typeof rawSettings === "object") {
    for (const key of SETTING_KEYS) {
      const v = (rawSettings as Row)[key];
      if (typeof v === "string") settings[key] = v;
    }
  }

  const exportedAt = typeof top.exportedAt === "number" ? top.exportedAt : 0;
  return makeBackup({ tasks, sessions, events }, settings, exportedAt);
}
