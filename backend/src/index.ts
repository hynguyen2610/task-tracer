import express from "express"
import cors from "cors"
import db from "./db/db"
import { Task } from "./types/task"

const app = express()
app.use(cors())
app.use(express.json())

const tasksWithoutPosition = db.prepare("SELECT * FROM tasks WHERE position IS NULL").all()
if (tasksWithoutPosition.length > 0) {
  tasksWithoutPosition.forEach((t: any, idx: number) => {
    db.prepare("UPDATE tasks SET position = ? WHERE id = ?").run(idx, t.id)
  })
}

function updateRunningTask() {
  const now = Date.now()
  const tasks = db.prepare("SELECT * FROM tasks WHERE isRunning = 1").all()
  tasks.forEach((t: any) => {
    if (t.lastStart) {
      const elapsed = Math.floor((now - t.lastStart) / 1000)
      db.prepare(
        "UPDATE tasks SET totalSeconds = totalSeconds + ?, lastStart = ? WHERE id = ?"
      ).run(elapsed, now, t.id)
    }
  })
}

app.get("/tasks", (req, res) => {
  updateRunningTask()
  const tasks = db.prepare("SELECT * FROM tasks ORDER BY position ASC").all()
  res.json(tasks)
})

app.post("/tasks", (req, res) => {
  const { title, priority } = req.body
  const maxRow = db.prepare("SELECT MAX(position) as max FROM tasks").get() as { max: number | null }
  const maxPos = maxRow.max ?? -1
  const stmt = db.prepare(
    "INSERT INTO tasks (title, totalSeconds, isRunning, lastStart, position, priority) VALUES (?, 0, 0, NULL, ?, ?)"
  )
  const result = stmt.run(title, maxPos + 1, priority)
  res.json(db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid))
})

app.post("/tasks/:id/toggle", (req, res) => {
  const id = parseInt(req.params.id, 10)
  updateRunningTask()
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task
  if (!task) return res.status(404).send("Task not found")
  if (task.isRunning) {
    db.prepare("UPDATE tasks SET isRunning = 0 WHERE id = ?").run(id)
  } else {
    db.prepare("UPDATE tasks SET isRunning = 0").run()
    db.prepare("UPDATE tasks SET isRunning = 1, lastStart = ? WHERE id = ?").run(Date.now(), id)
  }
  res.json(db.prepare("SELECT * FROM tasks ORDER BY position ASC").all())
})

app.put("/tasks/:id", (req, res) => {
  const { title, totalSeconds, priority } = req.body
  db.prepare(
    `UPDATE tasks 
     SET title = ?, 
         totalSeconds = COALESCE(?, totalSeconds), 
         priority = COALESCE(?, priority) 
     WHERE id = ?`
  ).run(title, totalSeconds, priority, req.params.id)
  res.json({ success: true })
})

app.post("/tasks/reorder", (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: "ids must be an array" })
  }
  const updateStmt = db.prepare("UPDATE tasks SET position = ? WHERE id = ?")
  ids.forEach((id: number, idx: number) => {
    updateStmt.run(idx, id)
  })
  res.json({ success: true })
})

app.delete("/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id, 10)
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id)
  res.json({ success: true })
})

const PORT = 4000
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})

