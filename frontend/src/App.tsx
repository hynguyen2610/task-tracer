import { useEffect, useState } from "react";
import axios from "axios";
import { Play, Pause, Trash2, Edit2, Check } from "lucide-react";
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
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const fetchTasks = async () => {
    const res = await axios.get<Task[]>(`${API_URL}/tasks`);
    setTasks(res.data);
  };

  const addTask = async () => {
    if (!newTitle.trim()) return;
    await axios.post<Task>(`${API_URL}/tasks`, { title: newTitle });
    setNewTitle("");
    fetchTasks();
  };

  const toggleTask = async (id: number) => {
    await axios.post<Task[]>(`${API_URL}/tasks/${id}/toggle`);
    fetchTasks();
  };

  const deleteTask = async (id: number) => {
    await axios.delete(`${API_URL}/tasks/${id}`);
    fetchTasks();
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
  };

  const saveEdit = async (id: number) => {
    await axios.put(`${API_URL}/tasks/${id}`, { title: editTitle });
    setEditingId(null);
    setEditTitle("");
    fetchTasks();
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

        {/* Add Task */}
        <div className="flex mb-6 space-x-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New task title..."
            className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={addTask}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            ➕ Add
          </button>
        </div>

        {/* Task List */}
        <div className="space-y-4">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-xl shadow-sm"
            >
              {/* Circle number */}
              <div className="flex-shrink-0 mr-4">
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold">
                  {index + 1}
                </div>
              </div>

              {/* Task content */}
              <div className="flex-1">
                {editingId === task.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="border rounded-lg px-2 py-1 w-full"
                  />
                ) : (
                  <>
                    <p className="font-medium text-gray-800">{task.title}</p>
                    <p className="text-gray-500 text-sm">
                      {formatTime(task.totalSeconds)}
                    </p>
                  </>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`w-10 h-10 flex items-center justify-center rounded-full text-white transition ${
                    task.isRunning
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-green-500 hover:bg-green-600"
                  }`}
                >
                  {task.isRunning ? <Pause /> : <Play />}
                </button>

                {editingId === task.id ? (
                  <button
                    onClick={() => saveEdit(task.id)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600"
                  >
                    <Check />
                  </button>
                ) : (
                  <button
                    onClick={() => startEditing(task)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-yellow-500 text-white hover:bg-yellow-600"
                  >
                    <Edit2 />
                  </button>
                )}

                <button
                  onClick={() => deleteTask(task.id)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-500 text-white hover:bg-gray-600"
                >
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="text-center text-gray-500 py-6">No tasks</div>
          )}
        </div>
      </div>
    </div>
  );
}

