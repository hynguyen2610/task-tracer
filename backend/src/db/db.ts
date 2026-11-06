import Database from "better-sqlite3";

const db = new Database("tasks.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    totalSeconds INTEGER NOT NULL DEFAULT 0,
    isRunning INTEGER NOT NULL DEFAULT 0,
    lastStart INTEGER,
    position INTEGER,
    priority TEXT NOT NULL DEFAULT 'Normal',
    status TEXT NOT NULL DEFAULT 'Todo'
  )
`).run();

// Databases created before task status existed: add the column, and mark a
// running task as In progress so a running task is never Todo.
const columns = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
if (!columns.some((c) => c.name === "status")) {
  db.transaction(() => {
    db.prepare("ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'Todo'").run();
    db.prepare("UPDATE tasks SET status = 'In progress' WHERE isRunning = 1").run();
  })();
}

const count = (db.prepare("SELECT COUNT(*) as c FROM tasks").get() as { c: number }).c;
if (count === 0) {
  db.prepare("INSERT INTO tasks (title) VALUES (?)").run("First task of the day");
}


export default db;
