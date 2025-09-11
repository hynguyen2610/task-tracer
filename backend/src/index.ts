import express from "express";
import cors from "cors";
import db from "./db/db";
import { Task } from './types/task';

const app = express();
app.use(cors());
app.use(express.json());

function updateRunningTask() {
  const now = Date.now();
  const tasks = db.prepare("SELECT * FROM tasks WHERE isRunning = 1").all();
  tasks.forEach((t: any) => {
    if (t.lastStart) {
      const elapsed = Math.floor((now - t.lastStart) / 1000);
      db.prepare(
        "UPDATE tasks SET totalSeconds = totalSeconds + ?, lastStart = ? WHERE id = ?"
      ).run(elapsed, now, t.id);
    }
  });
}

app.get("/tasks", (req, res) => {
  updateRunningTask();
  const tasks = db.prepare("SELECT * FROM tasks").all();
  res.json(tasks);
});

app.post("/tasks", (req, res) => {
  const { title } = req.body;
  const stmt = db.prepare(
    "INSERT INTO tasks (title, totalSeconds, isRunning) VALUES (?, 0, 0)"
  );
  const result = stmt.run(title);
  res.json(db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid));
});

app.post("/tasks/:id/toggle", (req, res) => {
  const id = parseInt(req.params.id, 10);
  updateRunningTask();

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task;
  if (!task) return res.status(404).send("Task not found");

  if (task.isRunning) {
    db.prepare("UPDATE tasks SET isRunning = 0 WHERE id = ?").run(id);
  } else {
    db.prepare("UPDATE tasks SET isRunning = 0").run(); // pause others
    db.prepare("UPDATE tasks SET isRunning = 1, lastStart = ? WHERE id = ?").run(Date.now(), id);
  }

  res.json(db.prepare("SELECT * FROM tasks").all());
});

app.put("/tasks/:id", (req, res) => {
  const { title, totalTime } = req.body; // totalTime in "HH:mm"
  let totalSeconds: number | undefined;

  if (totalTime) {
    const [h, m] = totalTime.split(":").map(Number);
    totalSeconds = h * 3600 + m * 60;
  }

  db.prepare(
  `UPDATE tasks SET title = ?, totalSeconds = COALESCE(?, totalSeconds) WHERE id = ?`
).run([title, totalSeconds, req.params.id]);
  res.json({ success: true });
});

app.delete("/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  res.json({ success: true });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
