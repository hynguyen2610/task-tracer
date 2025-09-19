import { useRef } from "react"
import type { Task } from "../types"

interface TaskFormProps {
  newTitle: string
  setNewTitle: (v: string) => void
  newPriority: Task["priority"]
  setNewPriority: (v: Task["priority"]) => void
  addTask: () => void
}

export default function TaskForm({ newTitle, setNewTitle, newPriority, setNewPriority, addTask }: TaskFormProps) {
  const newTaskInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex mb-6 space-x-2">
      <input
        ref={newTaskInputRef}
        type="text"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        placeholder="New task title..."
        onKeyDown={(e) => {
          if (e.key === "Enter") addTask()
        }}
        className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <select
        value={newPriority}
        onChange={(e) => setNewPriority(e.target.value as Task["priority"])}
        className="border rounded-lg px-2 py-2"
      >
        <option value="Highest">Highest</option>
        <option value="High">High</option>
        <option value="Normal">Normal</option>
        <option value="Low">Low</option>
      </select>
      <button
        onClick={addTask}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
      >
        ➕ Add
      </button>
    </div>
  )
}
