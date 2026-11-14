// Turns a tasks.db (this backend's, the desktop app's, or sample.db) into a
// backup file that the browser version imports (Backup > Import backup).
// Same format as frontend/src/core/backup.ts; see docs/SPEC.md 10.3.
//
//   cd backend
//   npm run export:json                         # tasks.db -> task-tracker-backup.json
//   npm run export:json -- other.db out.json --replace
//   npm run sample:json                         # fresh sample data as sample.json
//
// The database is only read. Older databases without some columns or without
// work history are fine: missing values are left out, as the import expects.

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const [dbArg = "tasks.db", outArg = "task-tracker-backup.json"] = args.filter((a) => !a.startsWith("--"));
const dbFile = path.resolve(dbArg);
const outFile = path.resolve(outArg);

if (!fs.existsSync(dbFile)) {
  console.error(`${dbFile} doesn't exist.`);
  process.exit(1);
}
if (fs.existsSync(outFile) && !replace) {
  console.error(`${outFile} already exists. Pass --replace to overwrite it.`);
  process.exit(1);
}

const db = new Database(dbFile, { readonly: true, fileMustExist: true });
const hasTable = (name) =>
  !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
const all = (sql) => db.prepare(sql).all();

// Drops null fields, which the import reads as "not set".
const clean = (row) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null));

const tasks = all("SELECT * FROM tasks ORDER BY position, id").map((t) =>
  clean({
    id: t.id,
    title: t.title,
    totalSeconds: t.totalSeconds,
    isRunning: t.isRunning === 1,
    lastStart: t.lastStart,
    position: t.position,
    priority: t.priority,
    // Before statuses existed, a running task was in progress (SPEC 4.6).
    status: t.status ?? (t.isRunning === 1 ? "In progress" : "Todo"),
    statusNote: t.statusNote,
    startedAt: t.startedAt === undefined ? t.lastStart : t.startedAt,
    lastWorkedAt: t.lastWorkedAt === undefined ? t.lastStart : t.lastWorkedAt,
  })
);
const sessions = hasTable("work_sessions")
  ? all("SELECT id, taskId, taskTitle, startedAt, endedAt FROM work_sessions ORDER BY id")
  : [];
const events = hasTable("task_events")
  ? all("SELECT * FROM task_events ORDER BY id").map(clean)
  : [];
db.close();

const backup = {
  format: "task-tracker-backup",
  version: 1,
  exportedAt: Date.now(),
  tasks,
  sessions,
  events,
  settings: {},
};
fs.writeFileSync(outFile, JSON.stringify(backup, null, 1));
console.log(`Wrote ${outFile}`);
console.log(`  ${tasks.length} tasks, ${sessions.length} work sessions, ${events.length} changes`);
console.log("  Import it in the app: Backup > Import backup.");
