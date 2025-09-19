import { useState } from "react"
import { formatTime } from "./utils/formatTime"
import TaskForm from "./components/TaskForm"
import TaskList from "./components/TaskList"
import GlobalToggle from "./components/GlobalToggle"
import ExportButton from "./components/ExportButton"
import { useTasks } from "./hooks/useTasks"
import type { Task } from "./types"
import "./App.css"

export default function App() {
  const { tasks, addTask, toggleTask, deleteTask, saveTask, reorderTasks, globalRunning, toggleGlobal } = useTasks()

  const [newTitle, setNewTitle] = useState("")
  const [newPriority, setNewPriority] = useState<Task["priority"]>("Normal")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editTime, setEditTime] = useState("")
  const [editPriority, setEditPriority] = useState<Task["priority"]>("Normal")

  const totalAllSeconds = tasks.reduce((sum, t) => sum + t.totalSeconds, 0)

  const startEditing = (task: Task) => {
    setEditingId(task.id)
    setEditTitle(task.title)
    const h = String(Math.floor(task.totalSeconds / 3600)).padStart(2, "0")
    const m = String(Math.floor((task.totalSeconds % 3600) / 60)).padStart(2, "0")
    setEditTime(`${h}:${m}`)
    setEditPriority(task.priority)
  }

  const saveEdit = async (id: number) => {
    const [h, m] = editTime.split(":").map(Number)
    const totalSeconds = h * 3600 + m * 60
    await saveTask(id, { title: editTitle, totalSeconds, priority: editPriority })
    setEditingId(null)
    setEditTitle("")
    setEditTime("")
    setEditPriority("Normal")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex justify-center items-start p-8">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 relative">
        <GlobalToggle running={globalRunning} onToggle={toggleGlobal} />
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Task Tracker</h1>
        <TaskForm newTitle={newTitle} setNewTitle={setNewTitle} newPriority={newPriority} setNewPriority={setNewPriority} addTask={() => addTask(newTitle, newPriority)} />
        <div className="mb-4 flex items-center justify-end space-x-2">
          <p className="text-right text-gray-700 font-medium">Total Time (All Tasks): {formatTime(totalAllSeconds)}</p>
          <ExportButton tasks={tasks} />
        </div>
        <TaskList
          tasks={tasks}
          editingId={editingId}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editTime={editTime}
          setEditTime={setEditTime}
          editPriority={editPriority}
          setEditPriority={setEditPriority}
          startEditing={startEditing}
          saveEdit={saveEdit}
          toggleTask={toggleTask}
          deleteTask={deleteTask}
          handleDragEnd={({ source, destination }) => {
            if (!destination) return
            const reordered = Array.from(tasks)
            const [moved] = reordered.splice(source.index, 1)
            reordered.splice(destination.index, 0, moved)
            reorderTasks(reordered.map(t => t.id))
          }}
        />
      </div>
    </div>
  )
}
