import { useEffect, useState } from "react";
import axios from "axios";
import { Play, Pause } from "lucide-react";
import type { Task } from "./types";

const API_URL = "http://localhost:4000";

function formatTime(totalSeconds: number): string {
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchTasks = async () => {
    const res = await axios.get<Task[]>(`${API_URL}/tasks`);
    setTasks(res.data);
  };

  const toggleTask = async (id: number) => {
    const res = await axios.post<Task[]>(`${API_URL}/tasks/${id}/toggle`);
    setTasks(res.data);
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex justify-center items-start p-8">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Task Tracker</h1>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-xl shadow-sm"
            >
              <div>
                <p className="font-medium text-gray-800">{task.title}</p>
                <p className="text-gray-500 text-sm">
                  {formatTime(task.totalSeconds)}
                </p>
              </div>
              <button
                onClick={() => toggleTask(task.id)}
                className={`w-12 h-12 flex items-center justify-center rounded-full text-white transition ${
                  task.isRunning
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-green-500 hover:bg-green-600"
                }`}
              >
                {task.isRunning ? <Pause /> : <Play />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
