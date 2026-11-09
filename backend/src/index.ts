import express from "express"
import cors from "cors"
import db from "./db/db"
import { STATUSES, Task, UNSTARTABLE_STATUSES } from "./types/task"

const app = express()
app.use(cors())
app.use(express.json())

const tasksWithoutPosition = db.prepare("SELECT * FROM tasks WHERE position IS NULL").all()
if (tasksWithoutPosition.length > 0) {
  tasksWithoutPosition.forEach((t: any, idx: number) => {
    db.prepare("UPDATE tasks SET position = ? WHERE id = ?").run(idx, t.id)
  })
}

// Adds the whole seconds elapsed and moves lastStart forward by exactly that
// much, so the leftover fraction counts next time instead of being lost on
// every poll (same as the Rust core).
function updateRunningTask() {
  const now = Date.now()
  const tasks = db.prepare("SELECT * FROM tasks WHERE isRunning = 1").all()
  tasks.forEach((t: any) => {
    if (t.lastStart) {
      const elapsed = Math.floor(Math.max(0, now - t.lastStart) / 1000)
      if (elapsed > 0) {
        db.prepare(
          "UPDATE tasks SET totalSeconds = totalSeconds + ?, lastStart = ?, lastWorkedAt = ? WHERE id = ?"
        ).run(elapsed, t.lastStart + elapsed * 1000, now, t.id)
      }
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
  const now = Date.now()
  if (task.isRunning) {
    db.prepare("UPDATE tasks SET isRunning = 0, lastWorkedAt = ? WHERE id = ?").run(now, id)
  } else {
    if (UNSTARTABLE_STATUSES.includes(task.status)) {
      return res.status(409).json({ error: `Cannot start a ${task.status} task` })
    }
    db.transaction(() => {
      db.prepare("UPDATE tasks SET isRunning = 0").run()
      db.prepare(
        `UPDATE tasks
         SET isRunning = 1,
             lastStart = ?,
             lastWorkedAt = ?,
             startedAt = COALESCE(startedAt, ?),
             status = CASE WHEN status = 'Todo' THEN 'In progress' ELSE status END
         WHERE id = ?`
      ).run(now, now, now, id)
    })()
  }
  res.json(db.prepare("SELECT * FROM tasks ORDER BY position ASC").all())
})

// Fields left out (or null) keep their current value. An empty statusNote
// clears the note.
app.put("/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id, 10)
  const { title, totalSeconds, priority, status, statusNote } = req.body
  if (status != null && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` })
  }
  const getTask = () => db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task | undefined
  if (!getTask()) return res.status(404).send("Task not found")

  db.transaction(() => {
    // A running task must stay In progress, so any other status stops the
    // timer. Bring its time up to date first so no elapsed time is lost.
    if (status != null && status !== "In progress") {
      updateRunningTask()
      db.prepare("UPDATE tasks SET isRunning = 0 WHERE id = ?").run(id)
    }
    const current = getTask()!
    const next = {
      title: title ?? current.title,
      totalSeconds: totalSeconds ?? current.totalSeconds,
      priority: priority ?? current.priority,
      status: (status ?? current.status) as Task["status"],
      statusNote:
        statusNote === undefined ? current.statusNote : String(statusNote ?? "").trim() || null,
    }
    const now = Date.now()
    const worked = next.status !== current.status || next.totalSeconds !== current.totalSeconds
    db.prepare(
      `UPDATE tasks
       SET title = ?, totalSeconds = ?, priority = ?, status = ?, statusNote = ?,
           startedAt = ?, lastWorkedAt = ?
       WHERE id = ?`
    ).run(
      next.title,
      next.totalSeconds,
      next.priority,
      next.status,
      next.statusNote,
      current.startedAt ?? (next.status !== "Todo" ? now : null),
      worked ? now : current.lastWorkedAt,
      id
    )
  })()
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

const PORT = Number(process.env.PORT ?? 4000)
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})

