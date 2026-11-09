import Database from "better-sqlite3";

// TASKS_DB lets the end-to-end tests use a throwaway database.
const db = new Database(process.env.TASKS_DB ?? "tasks.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS tasks (
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
  )
`).run();

/**
 * Adds a column to databases created before it existed, then runs the
 * backfill statements, all in one transaction.
 */
function addColumnIfMissing(name: string, definition: string, backfill: string[] = []) {
  const columns = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  if (columns.some((c) => c.name === name)) return;
  db.transaction(() => {
    db.prepare(`ALTER TABLE tasks ADD COLUMN ${name} ${definition}`).run();
    backfill.forEach((sql) => db.prepare(sql).run());
  })();
}

// A running task is never Todo.
addColumnIfMissing("status", "TEXT NOT NULL DEFAULT 'Todo'", [
  "UPDATE tasks SET status = 'In progress' WHERE isRunning = 1",
]);
addColumnIfMissing("statusNote", "TEXT");
// Older tasks only know when they were last started; use that as the best guess.
addColumnIfMissing("startedAt", "INTEGER", [
  "UPDATE tasks SET startedAt = lastStart WHERE lastStart IS NOT NULL",
]);
addColumnIfMissing("lastWorkedAt", "INTEGER", [
  "UPDATE tasks SET lastWorkedAt = lastStart WHERE lastStart IS NOT NULL",
]);

const count = (db.prepare("SELECT COUNT(*) as c FROM tasks").get() as { c: number }).c;
if (count === 0) {
  db.prepare("INSERT INTO tasks (title) VALUES (?)").run("First task of the day");
}


export default db;
