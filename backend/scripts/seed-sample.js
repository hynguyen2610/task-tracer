// Builds a sample database for trying every screen by hand.
//
//   cd backend
//   npm run seed:sample                # writes sample.db (refuses to overwrite)
//   npm run seed:sample -- other.db --replace
//   $env:TASKS_DB = "sample.db"; npm run dev      (PowerShell)
//   TASKS_DB=sample.db npm run dev                (bash)
//
// Past days use fixed clock times chosen to exercise the statistics rules
// (workday breaks, lunch, short gaps, evening work, midnight). Today's
// sessions are placed relative to now, so nothing is in the future.
// Same schema as src/db/db.ts and src/db/activity.ts.

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const file = path.resolve(args.find((a) => !a.startsWith("--")) ?? "sample.db");
if (fs.existsSync(file)) {
  if (!replace) {
    console.error(`${file} already exists. Pass --replace to overwrite it.`);
    process.exit(1);
  }
  fs.rmSync(file);
}

const db = new Database(file);
db.exec(`
  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    totalSeconds INTEGER NOT NULL DEFAULT 0,
    isRunning INTEGER NOT NULL DEFAULT 0,
    lastStart INTEGER,
    position INTEGER,
    priority TEXT NOT NULL DEFAULT 'Normal',
    status TEXT NOT NULL DEFAULT 'Todo',
    statusNote TEXT,
    startedAt INTEGER,
    lastWorkedAt INTEGER
  );
  CREATE TABLE work_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taskId INTEGER NOT NULL,
    taskTitle TEXT NOT NULL,
    startedAt INTEGER NOT NULL,
    endedAt INTEGER
  );
  CREATE INDEX work_sessions_startedAt ON work_sessions (startedAt);
  CREATE TABLE task_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taskId INTEGER NOT NULL,
    taskTitle TEXT NOT NULL,
    type TEXT NOT NULL,
    at INTEGER NOT NULL,
    status TEXT,
    fromSeconds INTEGER,
    toSeconds INTEGER
  );
  CREATE INDEX task_events_at ON task_events (at);
`);

const MIN = 60_000;
const now = Date.now();
const today = new Date();
today.setHours(0, 0, 0, 0);

/** The local day `n` weekdays before today (0 = today). */
function weekday(n) {
  const d = new Date(today);
  while (n > 0) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n--;
  }
  return d;
}
/** `day` at "HH:MM" local time, in epoch ms. */
const at = (day, hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
};
const daysAgo = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);

const D1 = weekday(1); // the full test day
const D2 = weekday(2);
const D3 = weekday(3);
const D4 = weekday(4);
const D5 = weekday(5);

/**
 * Each task: its row, sessions ([start, end|null]) and events. Totals,
 * startedAt and lastWorkedAt are worked out from the history below.
 */
const tasks = [
  {
    title: "ABC-9257 Analyze the mapping of order fields",
    priority: "High",
    status: "In progress",
    sessions: [
      [at(D4, "09:00"), at(D4, "12:00")],
      [at(D2, "23:15"), at(D2, "23:15") + 90 * MIN], // crosses midnight
      [at(D1, "07:30"), at(D1, "08:15")], // before the workday
      [at(D1, "10:31"), at(D1, "11:50")], // 1 min after the previous session: counts as work
      [at(D1, "19:00"), at(D1, "20:15")], // evening work counts in full
      [now - 3 * 60 * MIN, now - 2 * 60 * MIN],
      [now - 25 * MIN, null], // running now
    ],
    events: [{ type: "status", at: at(D4, "09:00"), status: "In progress" }],
  },
  {
    title: "ABC-9301: Fix login redirect loop",
    priority: "Highest",
    status: "Done",
    sessions: [
      [at(D2, "09:00"), at(D2, "11:30")],
      [at(D1, "09:00"), at(D1, "10:30")],
      [at(D1, "15:00"), at(D1, "17:30")],
      [now - 115 * MIN, now - 40 * MIN],
    ],
    events: [
      { type: "status", at: at(D2, "09:00"), status: "In progress" },
      { type: "status", at: now - 40 * MIN, status: "Done" },
    ],
  },
  {
    title: "Review PR for ABC-9288",
    priority: "Normal",
    status: "Pending",
    statusNote: "Waiting for Kiro",
    sessions: [[at(D1, "13:40"), at(D1, "15:00")]],
    events: [
      { type: "status", at: at(D1, "13:40"), status: "In progress" },
      { type: "status", at: at(D1, "15:00"), status: "Pending" },
    ],
  },
  {
    title: "Write onboarding notes",
    priority: "Low",
    status: "Todo",
    sessions: [],
    events: [],
  },
  {
    title: "Team sync",
    priority: "Normal",
    status: "Done",
    sessions: [[at(D1, "11:50"), at(D1, "11:55")]],
    events: [
      { type: "status", at: at(D1, "11:50"), status: "In progress" },
      // Forgot the timer: typed the time by hand.
      { type: "adjustment", at: at(D1, "16:00"), from: 300, to: 1800 },
      { type: "status", at: at(D1, "16:00"), status: "Done" },
    ],
  },
  {
    title: "Spike: GraphQL gateway",
    priority: "Low",
    status: "Canceled",
    sessions: [[at(D3, "13:30"), at(D3, "16:00")]],
    events: [
      { type: "status", at: at(D3, "13:30"), status: "In progress" },
      { type: "status", at: at(D3, "16:00"), status: "Canceled" },
    ],
  },
  {
    title: "Weekly status report",
    priority: "Normal",
    status: "Done",
    sessions: [
      [at(daysAgo(35), "10:00"), at(daysAgo(35), "11:00")], // shows in last month's calendar
      [at(D5, "16:00"), at(D5, "17:00")],
    ],
    events: [
      { type: "status", at: at(daysAgo(35), "10:00"), status: "In progress" },
      { type: "status", at: at(D5, "17:00"), status: "Done" },
    ],
  },
  {
    // In the history only: the task itself was deleted.
    title: "Prototype CSV export",
    deleted: true,
    sessions: [[at(D2, "13:30"), at(D2, "15:00")]],
    events: [{ type: "status", at: at(D2, "13:30"), status: "In progress" }],
  },
];

const insertTask = db.prepare(`
  INSERT INTO tasks (title, totalSeconds, isRunning, lastStart, position, priority, status,
                     statusNote, startedAt, lastWorkedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertSession = db.prepare(
  "INSERT INTO work_sessions (taskId, taskTitle, startedAt, endedAt) VALUES (?, ?, ?, ?)"
);
const insertEvent = db.prepare(`
  INSERT INTO task_events (taskId, taskTitle, type, at, status, fromSeconds, toSeconds)
  VALUES (?, ?, ?, ?, ?, ?, ?)`);

db.transaction(() => {
  let position = 0;
  let deletedId = 1000;
  for (const t of tasks) {
    const seconds = t.sessions.reduce((sum, [s, e]) => sum + Math.floor(((e ?? now) - s) / 1000), 0);
    const adjust = t.events
      .filter((e) => e.type === "adjustment")
      .reduce((sum, e) => sum + (e.to - e.from), 0);
    const moments = [...t.sessions.map(([s, e]) => e ?? now), ...t.events.map((e) => e.at)];
    const running = t.sessions.some(([, e]) => e === null);

    let id;
    if (t.deleted) {
      id = deletedId++;
    } else {
      const startedAt = t.status === "Todo" ? null : Math.min(...t.events.map((e) => e.at));
      id = insertTask.run(
        t.title,
        seconds + adjust,
        running ? 1 : 0,
        running ? now : null,
        position++,
        t.priority,
        t.status,
        t.statusNote ?? null,
        startedAt,
        moments.length ? Math.max(...moments) : null
      ).lastInsertRowid;
    }
    for (const [s, e] of t.sessions) insertSession.run(id, t.title, s, e);
    for (const e of t.events) {
      insertEvent.run(id, t.title, e.type, e.at, e.status ?? null, e.from ?? null, e.to ?? null);
    }
  }
})();

db.close();
const fmt = (d) => d.toDateString();
console.log(`Wrote ${file}`);
console.log(`  Full test day (breaks, lunch, evening work): ${fmt(D1)}`);
console.log(`  Session crossing midnight starts on:          ${fmt(D2)}`);
console.log(`  Deleted task's history on:                    ${fmt(D2)}`);
console.log(`  Last month's entry on:                        ${fmt(daysAgo(35))}`);
