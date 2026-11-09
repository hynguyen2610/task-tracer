import db from "./db";

// Work history for the statistics screen; same tables and rules as
// frontend/src-tauri/src/activity.rs. See docs/SPEC.md section 9.
//
// Rows copy the task title and have no foreign key, so history survives
// renames and deleted tasks.

db.exec(`
  CREATE TABLE IF NOT EXISTS work_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taskId INTEGER NOT NULL,
    taskTitle TEXT NOT NULL,
    startedAt INTEGER NOT NULL,
    endedAt INTEGER
  );
  CREATE INDEX IF NOT EXISTS work_sessions_startedAt ON work_sessions (startedAt);
  CREATE TABLE IF NOT EXISTS task_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taskId INTEGER NOT NULL,
    taskTitle TEXT NOT NULL,
    type TEXT NOT NULL,
    at INTEGER NOT NULL,
    status TEXT,
    fromSeconds INTEGER,
    toSeconds INTEGER
  );
  CREATE INDEX IF NOT EXISTS task_events_at ON task_events (at);
`);

export function openSession(taskId: number, title: string, now: number) {
  db.prepare("INSERT INTO work_sessions (taskId, taskTitle, startedAt) VALUES (?, ?, ?)").run(
    taskId,
    title,
    now
  );
}

/** Ends the open session of one task, or of every task when taskId is null. */
export function closeSessions(taskId: number | null, now: number) {
  if (taskId === null) {
    db.prepare("UPDATE work_sessions SET endedAt = ? WHERE endedAt IS NULL").run(now);
  } else {
    db.prepare("UPDATE work_sessions SET endedAt = ? WHERE endedAt IS NULL AND taskId = ?").run(
      now,
      taskId
    );
  }
}

export function recordStatus(taskId: number, title: string, status: string, now: number) {
  db.prepare(
    "INSERT INTO task_events (taskId, taskTitle, type, at, status) VALUES (?, ?, 'status', ?, ?)"
  ).run(taskId, title, now, status);
}

export function recordAdjustment(
  taskId: number,
  title: string,
  fromSeconds: number,
  toSeconds: number,
  now: number
) {
  db.prepare(
    `INSERT INTO task_events (taskId, taskTitle, type, at, fromSeconds, toSeconds)
     VALUES (?, ?, 'adjustment', ?, ?, ?)`
  ).run(taskId, title, now, fromSeconds, toSeconds);
}

/** Sessions that overlap [from, to) and events inside it, oldest first. */
export function between(from: number, to: number) {
  const sessions = db
    .prepare(
      `SELECT id, taskId, taskTitle, startedAt, endedAt FROM work_sessions
       WHERE startedAt < ? AND (endedAt IS NULL OR endedAt > ?)
       ORDER BY startedAt, id`
    )
    .all(to, from);
  const events = db
    .prepare(
      `SELECT id, taskId, taskTitle, type, at, status, fromSeconds, toSeconds
       FROM task_events WHERE at >= ? AND at < ? ORDER BY at, id`
    )
    .all(from, to);
  return { sessions, events };
}
