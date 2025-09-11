import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

interface Task {
  id: number;
  title: string;
  totalSeconds: number;
  isRunning: boolean;
  lastStart?: number;
}

let tasks: Task[] = [
  { id: 1, title: "Write report", totalSeconds: 0, isRunning: false },
  { id: 2, title: "Read book", totalSeconds: 0, isRunning: false },
  { id: 3, title: "Learn React", totalSeconds: 0, isRunning: false }
];

function updateRunningTask() {
  const now = Date.now();
  tasks.forEach(t => {
    if (t.isRunning && t.lastStart) {
      const elapsed = Math.floor((now - t.lastStart) / 1000);
      t.totalSeconds += elapsed;
      t.lastStart = now;
    }
  });
}

app.get("/tasks", (req, res) => {
  updateRunningTask();
  res.json(tasks);
});

app.post("/tasks/:id/toggle", (req, res) => {
  const id = parseInt(req.params.id, 10);
  updateRunningTask();
  tasks = tasks.map(t => {
    if (t.id === id) {
      if (t.isRunning) {
        t.isRunning = false;
      } else {
        t.isRunning = true;
        t.lastStart = Date.now();
      }
    } else {
      t.isRunning = false;
    }
    return t;
  });
  res.json(tasks);
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
