import { Play, Pause, Trash2, Edit2, Check } from "lucide-react"
import DurationInput from "../DurationInput"
import { formatTime } from "../utils/formatTime"
import type { Task } from "../types"

interface TaskItemProps {
  task: Task
  index: number
  editingId: number | null
  editTitle: string
  setEditTitle: (v: string) => void
  editTime: string
  setEditTime: (v: string) => void
  editPriority: Task["priority"]
  setEditPriority: (v: Task["priority"]) => void
  startEditing: (task: Task) => void
  saveEdit: (id: number) => void
  toggleTask: (id: number) => void
  deleteTask: (id: number) => void
}

export default function TaskItem({
  task, index, editingId, editTitle, setEditTitle,
  editTime, setEditTime, editPriority, setEditPriority,
  startEditing, saveEdit, toggleTask, deleteTask
}: TaskItemProps) {
  const priorityColors: Record<Task["priority"], string> = {
    Highest: "bg-red-100 border-l-4 border-red-500",
    High: "bg-orange-100 border-l-4 border-orange-500",
    Normal: "bg-green-100 border-l-4 border-green-500",
    Low: "bg-gray-100 border-l-4 border-gray-400",
  }

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-xl shadow-sm ${
        priorityColors[task.priority]
      } ${task.isRunning ? "glow border-blue-500" : ""}`}
    >
      <div className="flex items-center flex-1">
        <div className="flex-shrink-0 mr-4">
          <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold">
            {index + 1}
          </div>
        </div>

        {editingId === task.id ? (
          <div className="space-y-2 flex-1">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(task.id) }}
              onBlur={() => saveEdit(task.id)}
              className="border rounded-lg px-2 py-1 w-full"
            />
            <DurationInput
              value={editTime}
              onChange={setEditTime}
              onEnter={() => saveEdit(task.id)}
              onBlur={() => saveEdit(task.id)}
              className="border rounded-lg px-2 py-1"
            />
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as Task["priority"])}
              className="border rounded-lg px-2 py-1"
            >
              <option value="Highest">Highest</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
              <option value="Low">Low</option>
            </select>
          </div>
        ) : (
          <div>
            <p className="font-medium text-gray-800">{task.title}</p>
            <p className="text-gray-500 text-sm">⏱ {formatTime(task.totalSeconds)}</p>
            <p className="text-gray-500 text-sm">⭐ {task.priority}</p>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => toggleTask(task.id)}
          className={`w-10 h-10 flex items-center justify-center rounded-full text-white transition ${
            task.isRunning ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
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
  )
}
