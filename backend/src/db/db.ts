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
    priority TEXT NOT NULL DEFAULT 'Normal'
  )
`).run();

const count = (db.prepare("SELECT COUNT(*) as c FROM tasks").get() as { c: number }).c;
if (count === 0) {
  db.prepare("INSERT INTO tasks (title) VALUES (?)").run("First task of the day");
}


export default db;
